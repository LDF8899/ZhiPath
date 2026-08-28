import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LlmService } from '../../services/llm.service';
import { NotificationService } from '../../services/notification.service';
import { extractJson } from '../../common/json-repair';
import { ExamQuestion } from '../../entities/exam.entity';
import { QuestionGenerationTask } from '../../entities/question-generation-task.entity';
import { QuestionGenerationSnapshot } from '../../entities/question-generation-snapshot.entity';
import {
  GenerationConfig,
  GenerationProgress,
  NormalizedQuestion,
  normalizeGenerationConfig,
  normalizeQuestion,
  normalizeQuestions,
  validateGenerationConfig,
} from './question-generation.contracts';
import { buildSinglePrompt, buildBatchPrompt } from './question-generation.prompts';

const MAX_ATTEMPTS = 3;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

@Injectable()
export class QuestionGenerationService {
  constructor(
    private readonly llm: LlmService,
    private readonly notification: NotificationService,
    @InjectRepository(QuestionGenerationTask) private readonly taskRepo: Repository<QuestionGenerationTask>,
    @InjectRepository(QuestionGenerationSnapshot) private readonly snapshotRepo: Repository<QuestionGenerationSnapshot>,
    @InjectRepository(ExamQuestion) private readonly questionRepo: Repository<ExamQuestion>,
  ) {}

  async listTasks(userId: number, limit = 20) {
    return this.taskRepo.find({ where: { userId, status: 1 }, order: { createTime: 'DESC' }, take: Math.min(100, Math.max(1, limit)) });
  }

  async createTask(userId: number, input: any) {
    const validation = validateGenerationConfig(input);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const config = validation.config;
    const now = Date.now();
    const task = await this.taskRepo.save({
      userId,
      ...config,
      questionCount: config.count,
      referenceLibrary: config.referenceLibrary ? 1 : 0,
      taskStatus: 'pending',
      progress: { current: 0, total: config.count, failed: 0, message: '任务已创建' },
      resultCount: 0,
      createTime: now,
      updateTime: now,
      status: 1,
    } as any);
    console.log(`[QG] 任务已创建 id=${task.id} user=${userId} 主题=「${task.subject}」 题数=${task.questionCount} 难度=${config.difficulty} referenceLibrary=${config.referenceLibrary ? 1 : 0}`);
    return this.serializeTask(task);
  }

  async startTask(userId: number, taskId: number) {
    const task = await this.getOwnedTask(userId, taskId);
    if (task.taskStatus === 'completed') return this.serializeTask(task);
    if (task.taskStatus === 'running') return this.serializeTask(task);
    task.taskStatus = 'running';
    task.startedAt = task.startedAt || Date.now();
    task.progress = { current: task.resultCount || 0, total: task.questionCount, failed: 0, message: '后台生成已启动' };
    task.updateTime = Date.now();
    await this.taskRepo.save(task);
    console.log(`[QG] 任务 ${taskId} 启动后台生成（异步，进度将在快照/日志体现）`);
    void this.runTask(task.id).catch((error) => this.failTask(task.id, error));
    return this.serializeTask(task);
  }

  async getSnapshot(userId: number, taskId: number) {
    const task = await this.getOwnedTask(userId, taskId);
    const snapshot = await this.snapshotRepo.findOne({ where: { taskId, userId } });
    const questions = snapshot?.questions || [];
    const drafts = await this.questionRepo.find({ where: { generationTaskId: taskId, status: 0 }, order: { sourceOrder: 'ASC' } });
    const approved = await this.questionRepo.find({ where: { generationTaskId: taskId, status: 1 }, order: { sourceOrder: 'ASC' } });
    const prog = task.progress || ({} as any);
    console.log(`[QG-snapshot] task=${taskId} status=${task.taskStatus} progress=${prog.current || 0}/${task.questionCount || 0} 题数=${questions.length} 消息="${(prog.message || '').slice(0, 40)}"`);
    return {
      ...this.serializeTask(task),
      questions,
      config: snapshot?.config || this.configFromTask(task),
      reviewStatuses: snapshot?.reviewStatuses || questions.map(() => 'pending'),
      persistedQuestionIds: drafts.map((item) => item.id),
      approvedQuestionIds: approved.map((item) => item.id),
      hasSnapshot: questions.length > 0,
    };
  }

  async saveSnapshot(userId: number, taskId: number, questions: any[], config?: any, reviewStatuses?: string[]) {
    await this.getOwnedTask(userId, taskId);
    const normalized = normalizeQuestions(questions);
    const payload = JSON.stringify({ questions: normalized, config: config || {} });
    if (Buffer.byteLength(payload, 'utf8') > MAX_SNAPSHOT_BYTES) throw new Error('题目快照过大，请减少题目数量');
    const existing = await this.snapshotRepo.findOne({ where: { taskId, userId } });
    const snapshot = await this.snapshotRepo.save({
      ...(existing || {}),
      taskId,
      userId,
      questions: normalized,
      config: config || {},
      reviewStatuses: reviewStatuses || normalized.map(() => 'pending'),
      version: existing ? existing.version + 1 : 1,
      createTime: existing?.createTime || Date.now(),
      updateTime: Date.now(),
      status: 1,
    } as any);
    return { taskId, questionCount: snapshot.questions.length, version: snapshot.version, hasSnapshot: true };
  }

  async persistDrafts(userId: number, taskId: number, questions: any[]) {
    const task = await this.getOwnedTask(userId, taskId);
    const normalized = normalizeQuestions(questions);
    const existing = await this.questionRepo.find({ where: { generationTaskId: taskId }, order: { sourceOrder: 'ASC' } });
    const ids: number[] = [];
    for (let index = 0; index < normalized.length; index += 1) {
      const question = normalized[index];
      const row = existing.find((item) => item.sourceOrder === index) || ({} as ExamQuestion);
      // Never move an already-approved question back to draft on a repeated save.
      if (row.id && row.status === 1) {
        ids.push(row.id);
        continue;
      }
      const examPayload = this.toExamPayload(question);
      const saved = await this.questionRepo.save({
        ...row,
        generationTaskId: taskId,
        sourceOrder: index,
        examType: 1,
        skillName: task.subject,
        questionType: this.mapQuestionType(question.type),
        title: question.stem.slice(0, 500),
        content: examPayload.content,
        answer: examPayload.answer,
        difficulty: Math.min(5, Math.max(1, Math.round(task.difficulty / 2))),
        confidenceScore: Number(question.metadata?.confidence ?? 0.7),
        status: 0,
        createdBy: 'agent',
        createTime: row.createTime || Date.now(),
        updateTime: Date.now(),
      } as any);
      ids.push(saved.id);
    }
    await this.saveSnapshot(userId, taskId, normalized, this.configFromTask(task), normalized.map(() => 'pending'));
    return { persisted: ids.length, questionIds: ids };
  }

  async updateDraft(userId: number, taskId: number, questionId: number, payload: any) {
    await this.getOwnedTask(userId, taskId);
    const row = await this.questionRepo.findOne({ where: { id: questionId, generationTaskId: taskId, status: 0 } });
    if (!row) throw new Error('草稿题目不存在');
    const question = normalizeQuestion(payload);
    const examPayload = this.toExamPayload(question);
    row.questionType = this.mapQuestionType(question.type);
    row.title = question.stem.slice(0, 500);
    row.content = examPayload.content;
    row.answer = examPayload.answer;
    row.updateTime = Date.now();
    await this.questionRepo.save(row);
    return { updated: 1, questionId };
  }

  async approve(userId: number, taskId: number, questionIds: number[], questionsMap: Record<string, any> = {}) {
    await this.getOwnedTask(userId, taskId);
    if (!questionIds?.length) return { approved: 0, questionIds: [] };
    const rows = await this.questionRepo.find({ where: { id: In(questionIds), generationTaskId: taskId, status: 0 } });
    for (const row of rows) {
      const edited = questionsMap[String(row.id)];
      if (edited) {
        const question = normalizeQuestion(edited);
        const examPayload = this.toExamPayload(question);
        row.questionType = this.mapQuestionType(question.type);
        row.title = question.stem.slice(0, 500);
        row.content = examPayload.content;
        row.answer = examPayload.answer;
      }
      row.status = 1;
      row.reviewedBy = userId;
      row.reviewedAt = Date.now();
      row.updateTime = Date.now();
      await this.questionRepo.save(row);
    }
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId } });
    if (task) {
      task.updateTime = Date.now();
      await this.taskRepo.save(task);
    }
    return { approved: rows.length, questionIds: rows.map((row) => row.id) };
  }

  async deleteTask(userId: number, taskId: number) {
    const task = await this.getOwnedTask(userId, taskId);
    await this.questionRepo.delete({ generationTaskId: taskId, status: 0 });
    await this.snapshotRepo.delete({ taskId, userId });
    await this.taskRepo.delete(task.id);
    return { deleted: true };
  }

  /**
   * 聊天联动：一次多道、同步返回，供聊天智能体（generate_exam）调用。
   * 返回前端 exam 契约：{ skill, questions:[{ type, question, options[], answer, explanation, parts }] }。
   * 注意：不落库，由调用方（ActionExecutorService）写入 exam_records_v3 并复用现有反馈链路。
   */
  async generateForChat(userId: number, input: any): Promise<{ skill: string; questions: any[]; exam_id?: number }> {
    const config = normalizeGenerationConfig({ ...input, count: input?.count || input?.question_count || 5 });
    const count = Math.min(20, Math.max(1, config.count));
    const bankContext = config.referenceLibrary ? await this.loadBankContext(config) : undefined;
    const prompt = buildBatchPrompt(config, count, [], bankContext);
    const raw = await this.llm.chatCompletion([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], { temperature: 0.5, maxTokens: 8192, tier: 'pro', jsonObject: true });
    const data = extractJson(raw) || {};
    const source = Array.isArray(data.questions) ? data.questions : Array.isArray(data) ? data : [];
    const questions = source
      .map((q: any) => ({
        type: String(q.type || 'choice').toLowerCase(),
        question: String(q.question ?? q.stem ?? '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o: any) => String(typeof o === 'string' ? o : o?.text ?? '')).filter(Boolean) : [],
        answer: q.answer ?? '',
        explanation: String(q.explanation ?? q.solution ?? ''),
        parts: Array.isArray(q.parts) ? q.parts : [],
      }))
      .filter((q: any) => q.question.length > 0);
    return { skill: config.subject, questions };
  }

  private async runTask(taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId, status: 1 } });
    if (!task) return;
    const config = this.configFromTask(task);
    const questions: NormalizedQuestion[] = [];
    const seen = new Set<string>();
    const bankContext = config.referenceLibrary ? await this.loadBankContext(config) : undefined;
    console.log(`[QG] 任务 ${taskId} 开始生成，共 ${config.count} 题，主题=「${task.subject}」bankContext=${bankContext ? 'yes' : 'no'}`);
    for (let index = 0; index < config.count; index += 1) {
      let candidate: NormalizedQuestion | null = null;
      let lastError: any;
      const genStart = Date.now();
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !candidate; attempt += 1) {
        try {
          const raw = await this.generateOne(config, questions, bankContext);
          const candidates = Array.isArray(raw?.questions) ? raw.questions : Array.isArray(raw) ? raw : [raw];
          for (const item of candidates) {
            const normalized = normalizeQuestion(item, index);
            const key = normalized.stem.toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
            if (normalized.stem && !seen.has(key)) { candidate = normalized; break; }
            lastError = new Error('题干为空或重复');
          }
        } catch (error) { lastError = error; }
        if (!candidate && attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!candidate) throw new Error(`第 ${index + 1} 题生成失败${lastError ? `: ${lastError.message}` : ''}`);
      console.log(`[QG] 生成第 ${index + 1}/${config.count} 题 OK（耗时 ${Date.now() - genStart}ms，类型=${candidate.type}，题干前40字=${candidate.stem.slice(0, 40)}，有figure=${candidate.figure ? 'yes' : 'no'}）`);
      questions.push(candidate);
      seen.add(candidate.stem.toLowerCase().replace(/\s+/g, ' ').slice(0, 240));
      await this.updateProgress(taskId, { current: questions.length, total: config.count, failed: 0, message: `已生成 ${questions.length} / ${config.count} 题` }, questions, config);
    }
    const completed = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!completed) return;
    completed.taskStatus = 'completed';
    completed.resultCount = questions.length;
    completed.progress = { current: questions.length, total: config.count, failed: 0, message: '题目已生成，等待审核' };
    completed.completedAt = Date.now();
    completed.updateTime = Date.now();
    await this.taskRepo.save(completed);
    await this.saveSnapshotForTask(completed, questions, config);
    console.log(`[QG] 任务 ${taskId} 完成，共 ${questions.length} 题，等待审核`);
    this.notification.notifySystem(
      completed.userId,
      '出题完成',
      `「${completed.subject}」已生成 ${questions.length} 道题，等待审核。`,
      '/user/question-generator',
    ).catch(() => {});
  }

  private async generateOne(config: GenerationConfig, previous: NormalizedQuestion[], bankContext?: string) {
    const prompt = buildSinglePrompt(config, previous, bankContext);
    const raw = await this.llm.chatCompletion([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], { temperature: 0.5, maxTokens: 4096, tier: 'pro', jsonObject: true });
    return extractJson(raw);
  }

  /** 结合题库出题：按主题/知识点检索已入库题目，作为风格/考点参考与防重复基准。 */
  private async loadBankContext(config: GenerationConfig, limit = 6): Promise<string | undefined> {
    const terms = [config.subject, ...(config.topics || []).map((topic: any) => topic.label || topic.code || topic.id)].filter(Boolean);
    if (!terms.length) return undefined;
    const qb = this.questionRepo.createQueryBuilder('q')
      .where('q.status = 1')
      .orderBy('q.createTime', 'DESC')
      .limit(limit);
    const where: string[] = [];
    const params: Record<string, string> = {};
    terms.slice(0, 4).forEach((term, i) => {
      where.push('(q.skill_name LIKE :t' + i + ' OR q.title LIKE :t' + i + ')');
      params['t' + i] = `%${String(term)}%`;
    });
    if (where.length) qb.andWhere('(' + where.join(' OR ') + ')', params);
    const rows = await qb.getMany();
    if (!rows.length) return undefined;
    return rows.map((r) => {
      const options = Array.isArray((r.content as any)?.options) ? (r.content as any).options.slice(0, 4).join('/') : '';
      return `- ${String(r.title || '').slice(0, 120)}${options ? `（选项：${options}）` : ''}`;
    }).join('\n');
  }

  private async updateProgress(taskId: number, progress: GenerationProgress, questions: NormalizedQuestion[], config: GenerationConfig) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;
    task.progress = progress;
    task.resultCount = progress.current;
    task.updateTime = Date.now();
    await this.taskRepo.save(task);
    await this.saveSnapshotForTask(task, questions, config);
  }

  private async saveSnapshotForTask(task: QuestionGenerationTask, questions: NormalizedQuestion[], config: GenerationConfig) {
    const existing = await this.snapshotRepo.findOne({ where: { taskId: task.id, userId: task.userId } });
    await this.snapshotRepo.save({ ...(existing || {}), taskId: task.id, userId: task.userId, questions, config, reviewStatuses: questions.map(() => 'pending'), version: existing ? existing.version + 1 : 1, createTime: existing?.createTime || Date.now(), updateTime: Date.now(), status: 1 } as any);
  }

  private async failTask(taskId: number, error: any) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;
    task.taskStatus = 'failed';
    task.errorMessage = String(error?.message || error).slice(0, 500);
    task.progress = { ...(task.progress || { current: 0, total: task.questionCount, failed: 0 }), failed: 1, message: task.errorMessage };
    task.completedAt = Date.now();
    task.updateTime = Date.now();
    await this.taskRepo.save(task);
    console.error(`[QG] 任务 ${taskId} 失败：${task.errorMessage}`);
    this.notification.notifySystem(
      task.userId,
      '出题失败',
      `「${task.subject}」生成失败：${task.errorMessage}`,
      '/user/question-generator',
    ).catch(() => {});
  }

  private async getOwnedTask(userId: number, taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
    if (!task) throw new Error('出题任务不存在');
    return task;
  }

  private configFromTask(task: QuestionGenerationTask): GenerationConfig {
    return normalizeGenerationConfig({ subject: task.subject, curriculum: task.curriculum, locale: task.locale, grade: task.grade, questionTypes: task.questionTypes, count: task.questionCount, difficulty: task.difficulty, difficultyMix: task.difficultyMix, topics: task.topics, instructions: task.instructions, metadata: task.metadata, referenceLibrary: !!task.referenceLibrary });
  }

  private serializeTask(task: QuestionGenerationTask) {
    return { ...task, taskId: task.id, taskStatus: task.taskStatus, questionCount: task.questionCount, resultCount: task.resultCount, errorMessage: task.errorMessage, progress: task.progress };
  }

  private mapQuestionType(type: string): 'choice' | 'fill' | 'coding' | 'essay' {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'coding' || normalized === 'code') return 'coding';
    if (normalized === 'fill' || normalized === 'blank') return 'fill';
    if (normalized === 'essay' || normalized === 'lq' || normalized === 'short_answer') return 'essay';
    return 'choice';
  }

  private toExamPayload(question: NormalizedQuestion) {
    const options = question.options.map((option) => option.text);
    const answerText = String(question.answer ?? '');
    const answerIndex = question.options.findIndex((option, index) => option.key === answerText || option.text === answerText || String(index) === answerText);
    return {
      content: {
        stem: question.stem,
        options,
        optionKeys: question.options.map((option) => option.key),
        parts: question.parts,
        metadata: question.metadata,
        figure: question.figure || null,
      },
      answer: {
        value: answerIndex >= 0 ? answerIndex : question.answer,
        key: answerText,
        explanation: question.solution,
      },
    };
  }
}
