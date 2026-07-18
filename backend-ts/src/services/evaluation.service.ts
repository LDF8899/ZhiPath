import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EvaluationAttempt,
  EvaluationAttemptType,
} from '../entities/evaluation-attempt.entity';
import {
  EvaluationEvidence,
  EvaluationEvidenceType,
} from '../entities/evaluation-evidence.entity';
import {
  EvaluationResult,
  EvaluationEvaluatorType,
} from '../entities/evaluation-result.entity';
import { EvaluationDimensionScore } from '../entities/evaluation-dimension-score.entity';
import { EvaluationImpact } from '../entities/evaluation-impact.entity';
import { EvaluationRubric } from '../entities/evaluation-rubric.entity';
import { EventsService } from '../modules/events/events.service';

export interface EvaluationDimensionInput {
  key?: string;
  name: string;
  score: number;
  maxScore?: number;
  weight?: number;
  trend?: 'up' | 'down' | 'stable' | string;
  detail?: string;
  evidenceRefs?: any[];
}

export interface EvaluationRecordInput {
  userId: number;
  attemptType: EvaluationAttemptType;
  sourceType?: string | null;
  sourceId?: string | number | null;
  skillName?: string | null;
  goal?: string | null;
  rubricKey?: string;
  rubricVersion?: string;
  evaluatorType?: EvaluationEvaluatorType;
  evaluatorName?: string | null;
  score: number;
  maxScore?: number;
  passed?: boolean | null;
  confidence?: number;
  level?: string | null;
  summary?: string | null;
  feedback?: Record<string, any> | null;
  rawResult?: Record<string, any> | null;
  evidenceType?: EvaluationEvidenceType;
  evidence?: Record<string, any> | null;
  evidenceSummary?: string | null;
  dimensions?: EvaluationDimensionInput[];
  commitOutcome?: any;
  nextActions?: any[];
  metadata?: Record<string, any> | null;
}

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(EvaluationRubric) private readonly rubricRepo: Repository<EvaluationRubric>,
    @InjectRepository(EvaluationAttempt) private readonly attemptRepo: Repository<EvaluationAttempt>,
    @InjectRepository(EvaluationEvidence) private readonly evidenceRepo: Repository<EvaluationEvidence>,
    @InjectRepository(EvaluationResult) private readonly resultRepo: Repository<EvaluationResult>,
    @InjectRepository(EvaluationDimensionScore) private readonly dimensionRepo: Repository<EvaluationDimensionScore>,
    @InjectRepository(EvaluationImpact) private readonly impactRepo: Repository<EvaluationImpact>,
    private readonly eventsService: EventsService,
  ) {}

  async record(input: EvaluationRecordInput) {
    const now = Date.now();
    const rubricKey = input.rubricKey || this.defaultRubricKey(input.attemptType);
    const rubricVersion = input.rubricVersion || '1.0.0';
    const maxScore = input.maxScore || 100;
    const normalizedScore = this.normalizeScore(input.score, maxScore);

    await this.ensureRubric(rubricKey, rubricVersion, input.attemptType, maxScore);

    const attempt = await this.attemptRepo.save({
      userId: input.userId,
      attemptType: input.attemptType,
      sourceType: input.sourceType || null,
      sourceId: input.sourceId == null ? null : String(input.sourceId),
      skillName: input.skillName || null,
      goal: input.goal || null,
      attemptStatus: input.commitOutcome ? 'committed' : 'graded',
      rubricKey,
      rubricVersion,
      startedAt: now,
      completedAt: now,
      metadataJson: input.metadata || null,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const evidence = await this.evidenceRepo.save({
      userId: input.userId,
      attemptId: attempt.id,
      evidenceType: input.evidenceType || this.defaultEvidenceType(input.attemptType),
      sourceType: input.sourceType || null,
      sourceId: input.sourceId == null ? null : String(input.sourceId),
      skillName: input.skillName || null,
      summary: input.evidenceSummary || input.summary || null,
      payloadJson: input.evidence || null,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const result = await this.resultRepo.save({
      userId: input.userId,
      attemptId: attempt.id,
      skillName: input.skillName || null,
      evaluatorType: input.evaluatorType || 'system',
      evaluatorName: input.evaluatorName || null,
      score: input.score,
      maxScore,
      normalizedScore,
      level: input.level || this.levelFor(normalizedScore),
      passed: input.passed == null ? null : input.passed ? 1 : 0,
      confidence: this.clamp(input.confidence ?? 0.7, 0, 1),
      summary: input.summary || null,
      feedbackJson: input.feedback || null,
      rawResultJson: input.rawResult || null,
      rubricKey,
      rubricVersion,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const dimensions = await this.saveDimensions(input.userId, attempt.id, result.id, input.dimensions, evidence.id);
    const impact = await this.saveImpact(input.userId, attempt.id, result.id, input.commitOutcome, input.nextActions);

    const payload = { attempt, evidence, result, dimensions, impact };
    this.eventsService.emit(input.userId, {
      type: 'evaluation_updated',
      data: payload,
    });

    return payload;
  }

  async listRecent(userId: number, limit = 20) {
    const attempts = await this.attemptRepo.find({
      where: { userId, status: 1 },
      order: { completedAt: 'DESC', id: 'DESC' },
      take: Math.max(1, Math.min(100, limit)),
    });
    if (!attempts.length) return [];

    const attemptIds = attempts.map((a) => a.id);
    const [results, impacts] = await Promise.all([
      this.resultRepo
        .createQueryBuilder('r')
        .where('r.user_id = :userId', { userId })
        .andWhere('r.attempt_id IN (:...attemptIds)', { attemptIds })
        .andWhere('r.status = 1')
        .getMany(),
      this.impactRepo
        .createQueryBuilder('i')
        .where('i.user_id = :userId', { userId })
        .andWhere('i.attempt_id IN (:...attemptIds)', { attemptIds })
        .andWhere('i.status = 1')
        .getMany(),
    ]);
    const resultByAttempt = new Map(results.map((r) => [r.attemptId, r]));
    const impactByAttempt = new Map(impacts.map((i) => [i.attemptId, i]));
    return attempts.map((attempt) => ({
      attempt,
      result: resultByAttempt.get(attempt.id) || null,
      impact: impactByAttempt.get(attempt.id) || null,
    }));
  }

  async getDetail(userId: number, attemptId: number) {
    const attempt = await this.attemptRepo.findOne({ where: { id: attemptId, userId, status: 1 } });
    if (!attempt) throw new NotFoundException('evaluation attempt not found');
    const [evidence, result, dimensions, impact] = await Promise.all([
      this.evidenceRepo.find({ where: { userId, attemptId, status: 1 }, order: { id: 'ASC' } }),
      this.resultRepo.findOne({ where: { userId, attemptId, status: 1 } }),
      this.dimensionRepo.find({ where: { userId, attemptId, status: 1 }, order: { id: 'ASC' } }),
      this.impactRepo.findOne({ where: { userId, attemptId, status: 1 } }),
    ]);
    return { attempt, evidence, result, dimensions, impact };
  }

  private async saveDimensions(
    userId: number,
    attemptId: number,
    resultId: number,
    dimensions: EvaluationDimensionInput[] | undefined,
    evidenceId: number,
  ) {
    const now = Date.now();
    const rows = (dimensions || []).map((dimension) => {
      const maxScore = dimension.maxScore || 100;
      return {
        userId,
        attemptId,
        resultId,
        dimensionKey: dimension.key || this.key(dimension.name),
        dimensionName: dimension.name,
        score: dimension.score,
        maxScore,
        normalizedScore: this.normalizeScore(dimension.score, maxScore),
        weight: dimension.weight || 1,
        trend: dimension.trend || 'stable',
        detail: dimension.detail || null,
        evidenceRefsJson: dimension.evidenceRefs || [{ evidenceId }],
        createTime: now,
        updateTime: now,
        status: 1,
      };
    });
    return rows.length ? this.dimensionRepo.save(rows) : [];
  }

  private async saveImpact(userId: number, attemptId: number, resultId: number, commitOutcome: any, nextActions?: any[]) {
    const now = Date.now();
    const delta = commitOutcome?.delta || commitOutcome?.gitDelta || null;
    const commit = commitOutcome?.commit || null;
    const snapshot = commitOutcome?.snapshot || null;
    const branch = commitOutcome?.branch || null;
    return this.impactRepo.save({
      userId,
      attemptId,
      resultId,
      commitId: commit?.id || null,
      snapshotId: snapshot?.id || commit?.snapshotId || null,
      branchId: branch?.id || commit?.branchId || null,
      skillChangesJson: delta?.skillChanges || null,
      radarChangesJson: delta?.radarChanges || null,
      metricsChangeJson: delta?.metricsChange || null,
      matchScoreDelta: Number(delta?.metricsChange?.matchScore || 0),
      nextActionsJson: nextActions || null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  private async ensureRubric(key: string, version: string, attemptType: EvaluationAttemptType, maxScore: number) {
    const existing = await this.rubricRepo.findOne({ where: { rubricKey: key, version, status: 1 } });
    if (existing) return existing;
    const now = Date.now();
    return this.rubricRepo.save({
      rubricKey: key,
      name: this.rubricName(attemptType),
      version,
      targetType: attemptType === 'ai_assessment' ? 'learning_action' : 'skill',
      passScore: Math.min(100, Math.round(maxScore * 0.7)),
      dimensionsJson: null,
      weightsJson: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  private defaultRubricKey(attemptType: EvaluationAttemptType) {
    if (attemptType === 'quick_test') return 'quick_test_skill_v1';
    if (attemptType === 'progress_quiz') return 'learning_quiz_v1';
    if (attemptType === 'ai_assessment') return 'ai_learning_assessment_v1';
    return 'learning_action_v1';
  }

  private defaultEvidenceType(attemptType: EvaluationAttemptType): EvaluationEvidenceType {
    if (attemptType === 'progress_quiz' || attemptType === 'quick_test') return 'quiz_answer';
    if (attemptType === 'ai_assessment') return 'conversation';
    if (attemptType === 'progress_code') return 'code';
    return 'learning_action';
  }

  private rubricName(attemptType: EvaluationAttemptType) {
    const names: Record<string, string> = {
      progress_read: 'Learning action rubric',
      progress_quiz: 'Learning quiz rubric',
      progress_code: 'Code practice rubric',
      skill_complete: 'Skill completion rubric',
      quick_test: 'Quick test rubric',
      exam: 'Exam rubric',
      ai_assessment: 'AI learning assessment rubric',
      chat_resource: 'Chat resource rubric',
      manual: 'Manual evaluation rubric',
    };
    return names[attemptType] || 'Evaluation rubric';
  }

  private normalizeScore(score: number, maxScore: number) {
    if (!maxScore) return 0;
    return this.clamp(Math.round((Number(score || 0) / Number(maxScore)) * 10000) / 100, 0, 100);
  }

  private levelFor(score: number) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'basic';
    return 'needs_work';
  }

  private key(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '');
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }
}
