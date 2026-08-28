import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';
import { ExamQuestion } from '../../entities/exam.entity';
import { QuestionBankImport } from '../../entities/question-bank-import.entity';
import { QuestionBankImportCandidate } from '../../entities/question-bank-import-candidate.entity';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_QUESTIONS_PER_IMPORT = 100;

const EXTRACTION_SYSTEM = `你是学科试卷题目提取助手。请从上传的试卷图片/文档中提取所有可作答的题目。
要求：
1. 识别页面上所有题目，不要遗漏；若一题分多小题，保留为独立题目或在 explanation 中说明。
2. 题目文字、选项、答案均保留原文；数学公式可用 LaTeX。
3. 不要编造原图中不存在的题目、选项或答案。
4. 选择题 options 为 4 个选项文本数组，answer 为该选项的正确下标(0 起)；填空/简答/编程 answer 填答案文本。
5. 每道题给出 difficulty(1-5) 和 topics(知识点建议)。
严格只输出 JSON，不要 Markdown。格式：
{"questions":[{"question":"题干","type":"choice|fill|essay|coding","options":["..."],"answer":0,"explanation":"解析","difficulty":3,"topics":["知识点"]}]}`;

@Injectable()
export class QuestionBankImportService {
  constructor(
    @InjectRepository(QuestionBankImport) private readonly importRepo: Repository<QuestionBankImport>,
    @InjectRepository(QuestionBankImportCandidate) private readonly candidateRepo: Repository<QuestionBankImportCandidate>,
    @InjectRepository(ExamQuestion) private readonly questionRepo: Repository<ExamQuestion>,
    private readonly llm: LlmService,
  ) {}

  async importBatch(userId: number, input: { filename?: string; fileType?: string; images: string[] }) {
    const images = Array.isArray(input.images) ? input.images.filter(Boolean) : [];
    if (!images.length) throw new BadRequestException('请上传至少一张题目图片');
    const filename = String(input.filename || '上传图片').slice(0, 500);
    const fileType = String(input.fileType || 'image');

    let buffer: Buffer | null = null;
    if (images.length === 1 && images[0].startsWith('data:')) {
      try { buffer = Buffer.from(images[0].split(',')[1], 'base64'); } catch { /* ignore */ }
    }
    if (buffer && buffer.length > MAX_FILE_BYTES) throw new BadRequestException('文件过大，请压缩后上传（<8MB）');
    const fileHash = buffer ? createHash('sha256').update(buffer).digest('hex') : '';
    const now = Date.now();

    const batch = await this.importRepo.save({
      userId,
      filename,
      fileType,
      importStatus: 'processing',
      totalQuestions: 0,
      importedCount: 0,
      progress: 0,
      pagesTotal: images.length,
      pagesDone: 0,
      fileSize: buffer?.length ?? null,
      fileHash,
      createTime: now,
      updateTime: now,
      status: 1,
    } as any);
    console.log(`[OCR] 批${batch.id} 已创建：user=${userId} file=${filename.slice(0, 40)} 图片数=${images.length} 大小=${buffer?.length || 0}字节`);

    try {
      const allQuestions: any[] = [];
      for (let idx = 0; idx < images.length; idx += 1) {
        const ocrStart = Date.now();
        const raw = await this.llm.chatCompletionVision(EXTRACTION_SYSTEM, [images[idx]], { maxTokens: 4096, temperature: 0.2, jsonObject: true });
        const parsed = extractJson(raw) as any;
        const list = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];
        allQuestions.push(...list.filter((q: any) => q && String(q.question || q.stem || '').trim()));
        console.log(`[OCR] 批${batch.id} 第 ${idx + 1}/${images.length} 页识别完成（耗时 ${Date.now() - ocrStart}ms，本页识别 ${list.length} 题，累计 ${allQuestions.length} 题）`);
        batch.pagesDone = idx + 1;
        batch.progress = Math.round(((idx + 1) / images.length) * 100);
        batch.updateTime = Date.now();
        await this.importRepo.save(batch);
      }

      const questions = allQuestions.slice(0, MAX_QUESTIONS_PER_IMPORT);
      const candidates: any[] = questions.map((q: any, index: number) => ({
        ...this.normalizeCandidate(q, index),
        importId: batch.id,
        userId,
      }));
      const saved = await this.candidateRepo.save(candidates as any);

      batch.parseResult = saved.map((c) => ({ type: c.questionType, difficulty: c.difficulty, needsReview: c.needsReview }));
      batch.totalQuestions = saved.length;
      batch.importStatus = saved.length ? 'parsed' : 'error';
      if (!saved.length) batch.errorMessage = '未识别到题目，请检查图片清晰度';
      batch.updateTime = Date.now();
      await this.importRepo.save(batch);
      console.log(`[OCR] 批${batch.id} 识别完成：共 ${saved.length} 题 -> ${saved.length ? 'parsed' : 'error'}`);
      return this.serialize(batch, saved);
    } catch (e: any) {
      batch.importStatus = 'error';
      batch.errorMessage = String(e?.message || e).slice(0, 500);
      batch.updateTime = Date.now();
      await this.importRepo.save(batch);
      console.error(`[OCR] 批${batch.id} 失败：${batch.errorMessage}`);
      throw new BadRequestException(`OCR 失败：${batch.errorMessage}`);
    }
  }

  async listImports(userId: number, limit = 20) {
    const rows = await this.importRepo.find({
      where: { userId, status: 1 },
      order: { createTime: 'DESC' },
      take: Math.min(50, Math.max(1, limit)),
    });
    return rows.map((r) => this.serialize(r));
  }

  async getImport(userId: number, importId: number) {
    const batch = await this.getOwned(userId, importId);
    const candidates = await this.candidateRepo.find({ where: { importId, userId }, order: { sourceOrder: 'ASC' } });
    return this.serialize(batch, candidates);
  }

  async confirmImport(userId: number, importId: number, candidateIds: number[]) {
    const batch = await this.getOwned(userId, importId);
    if (!candidateIds?.length) return { imported: 0, questionIds: [] };
    const rows = await this.candidateRepo.find({ where: { id: In(candidateIds), importId, userId } });
    const skillName = String(batch.filename || '').replace(/\.[^.]+$/, '') || '';
    const questionIds: number[] = [];
    for (const row of rows) {
      if (row.imported) continue;
      const examPayload = this.toExamPayload(row);
      const saved = await this.questionRepo.save({
        examType: 1,
        skillName: String(row.topicSuggestions?.[0] || '') || skillName,
        questionType: this.mapType(row.questionType),
        title: String(row.stem || '').slice(0, 500),
        content: examPayload.content,
        answer: examPayload.answer,
        difficulty: Math.min(5, Math.max(1, row.difficulty || 3)),
        confidenceScore: Number(row.confidence ?? 0.8),
        status: 1,
        createdBy: 'agent',
        createTime: Date.now(),
        updateTime: Date.now(),
      } as any);
      row.imported = 1;
      row.questionId = saved.id;
      row.updateTime = Date.now();
      await this.candidateRepo.save(row);
      questionIds.push(saved.id);
    }
    batch.importedCount = await this.candidateRepo.count({ where: { importId, userId, imported: 1 } });
    batch.importStatus = 'imported';
    batch.updateTime = Date.now();
    await this.importRepo.save(batch);
    return { imported: questionIds.length, questionIds };
  }

  async deleteImport(userId: number, importId: number) {
    await this.getOwned(userId, importId);
    await this.candidateRepo.delete({ importId, userId });
    await this.importRepo.delete({ id: importId, userId });
    return { deleted: true };
  }

  private normalizeCandidate(q: any, index: number): any {
    const options = Array.isArray(q.options) ? q.options.map((o: any) => String(typeof o === 'string' ? o : o?.text ?? '')).filter(Boolean) : [];
    const answerText = q.answer ?? q.answer_key ?? '';
    const answerIndex = typeof answerText === 'number' ? answerText : options.findIndex((o) => o === answerText);
    const type = String(q.type || q.question_type || (options.length ? 'choice' : 'fill')).toLowerCase();
    return {
      sourceOrder: index,
      questionType: type,
      stem: String(q.question ?? q.stem ?? '').trim(),
      options,
      answer: { value: answerIndex >= 0 ? answerIndex : answerText, explanation: String(q.explanation ?? q.solution ?? '') },
      explanation: String(q.explanation ?? q.solution ?? '') || null,
      difficulty: Math.min(5, Math.max(1, Number(q.difficulty ?? q.difficulty_level ?? 3) || 3)),
      confidence: Number(q.confidence ?? 0.8),
      topicSuggestions: Array.isArray(q.topics) ? q.topics.map((t: any) => String(t)) : [],
      needsReview: Number((q.needs_review ?? q.needsReview ?? 0) ? 1 : 0),
      imported: 0,
      createTime: Date.now(),
      updateTime: Date.now(),
      status: 1,
    };
  }

  private toExamPayload(row: QuestionBankImportCandidate) {
    const options = Array.isArray(row.options) ? row.options : [];
    const rawAnswer = row.answer as any;
    const answerIndex = typeof rawAnswer?.value === 'number' ? rawAnswer.value : -1;
    return {
      content: { stem: String(row.stem || ''), options, parts: [], metadata: { topicSuggestions: row.topicSuggestions || [] } },
      answer: { value: answerIndex >= 0 ? answerIndex : rawAnswer?.value, key: String(rawAnswer?.key ?? ''), explanation: row.explanation || '' },
    };
  }

  private mapType(type: string): 'choice' | 'fill' | 'coding' | 'essay' {
    const t = String(type || '').toLowerCase();
    if (t === 'coding' || t === 'code') return 'coding';
    if (t === 'essay' || t === 'lq' || t === 'short_answer') return 'essay';
    if (t === 'fill' || t === 'blank' || t === 'judge') return 'fill';
    return 'choice';
  }

  private async getOwned(userId: number, importId: number) {
    const batch = await this.importRepo.findOne({ where: { id: importId, userId, status: 1 } });
    if (!batch) throw new NotFoundException('导入批次不存在');
    return batch;
  }

  private serialize(batch: QuestionBankImport, candidates?: QuestionBankImportCandidate[]) {
    return {
      ...batch,
      importId: batch.id,
      candidates: candidates?.map((c) => ({ ...c, candidateId: c.id })) || undefined,
    };
  }
}
