import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillService } from '../../services/skill.service';
import { QuestionGenerationService } from '../question-generation/question-generation.service';
import { RemediationRun } from '../../entities/remediation-run.entity';

const WEAK_THRESHOLD = 60; // masteryPct 低于该值视为弱项
const MAX_WEAK_POINTS = 6;

export interface RemedyConfig {
  subject: string;
  count: number;
  difficulty: number;
  questionTypes: string[];
  topics: Array<{ label: string }>;
  instructions: string;
  referenceLibrary: boolean;
}

@Injectable()
export class RemediationService {
  constructor(
    private readonly skillService: SkillService,
    private readonly questionGeneration: QuestionGenerationService,
    @InjectRepository(RemediationRun) private readonly runRepo: Repository<RemediationRun>,
  ) {}

  /** 读取用户弱项（掌握度 < threshold 的技能）。 */
  async weakPoints(userId: number) {
    const skills = await this.skillService.getEffectiveSkills(userId);
    return skills
      .filter((s) => Number(s.masteryPct) < WEAK_THRESHOLD)
      .sort((a, b) => Number(a.masteryPct) - Number(b.masteryPct))
      .slice(0, MAX_WEAK_POINTS)
      .map((s) => ({ label: s.name, masteryPct: Number(s.masteryPct) }));
  }

  /** 把弱项包装成一份「由浅入深」的补弱出题配置。 */
  buildConfig(weakTopics: Array<{ label: string }>, input: Record<string, any> = {}): RemedyConfig {
    const topics = weakTopics.length ? weakTopics : [{ label: String(input.subject || '综合能力') }];
    const count = Math.min(20, Math.max(1, Number(input.count) || 5));
    const difficulty = Math.min(10, Math.max(1, Number(input.difficulty) || 6));
    return {
      subject: topics[0].label || String(input.subject || ''),
      count,
      difficulty,
      questionTypes: Array.isArray(input.questionTypes) && input.questionTypes.length ? input.questionTypes : ['choice', 'fill'],
      topics,
      instructions: '这是针对薄弱点的补弱练习。请由浅入深：先基础巩固（单步），再进阶应用（两步以上），最后综合/判断；题目须能暴露该薄弱点的常见错误，并给出可判分的解析。',
      referenceLibrary: true,
    };
  }

  async prepare(userId: number, input: Record<string, any> = {}) {
    const explicitTopics = Array.isArray(input.topics) && input.topics.length
      ? input.topics.map((t: any) => ({ label: String(t?.label ?? t ?? '').trim() })).filter((t) => t.label)
      : [];
    const weakPoints = explicitTopics.length ? explicitTopics : await this.weakPoints(userId);
    const config = this.buildConfig(weakPoints, input);
    return { weakPoints, config };
  }

  /** 直接创建并启动一个补弱出题任务，并记录"补强前"掌握度（用于前后对比画像归档）。 */
  async generate(userId: number, input: Record<string, any> = {}) {
    const { weakPoints, config } = await this.prepare(userId, input);
    const task = await this.questionGeneration.createTask(userId, config);
    await this.questionGeneration.startTask(userId, task.taskId);
    // 记录本次补强的"补强前"掌握度
    const beforeMap = (await this.weakPoints(userId)).reduce((map: Record<string, number>, w) => { map[w.label] = w.masteryPct; return map; }, {});
    const run = await this.runRepo.save({
      userId,
      topics: weakPoints.map((t) => ({ label: t.label, beforeMastery: Number(beforeMap[t.label] ?? 0) })),
      taskId: task.taskId,
      runStatus: 'pending',
      createTime: Date.now(),
      updateTime: Date.now(),
      status: 1,
    } as any);
    return { weakPoints, config, taskId: task.taskId, runId: run.id };
  }

  /** 补强历史：每次补强的知识点 + 补强前/当前掌握度 + 增量（用于画像卡片）。 */
  async history(userId: number, limit = 10) {
    const runs = await this.runRepo.find({ where: { userId, status: 1 }, order: { createTime: 'DESC' }, take: Math.min(30, Math.max(1, limit)) });
    const current = await this.skillService.getEffectiveSkills(userId);
    const currentMap: Record<string, number> = current.reduce((map: Record<string, number>, s) => { map[s.name] = Number(s.masteryPct); return map; }, {});
    return runs.map((run) => ({
      id: run.id,
      taskId: run.taskId,
      createTime: run.createTime,
      topics: (run.topics || []).map((t) => {
        const before = Number(t.beforeMastery ?? 0);
        const now = Number(currentMap[t.label] ?? before);
        return { label: t.label, beforeMastery: before, currentMastery: now, delta: Math.round((now - before) * 100) / 100 };
      }),
    }));
  }
}
