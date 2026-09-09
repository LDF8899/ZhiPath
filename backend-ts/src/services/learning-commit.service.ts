import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningBranch, LearningBranchType } from '../entities/learning-branch.entity';
import { LearningCommit, LearningCommitType } from '../entities/learning-commit.entity';
import { SkillService } from './skill.service';
import { SkillSnapshotService } from './skill-snapshot.service';
import { MatchAgentService } from './match-agent.service';
import { EventsService } from '../modules/events/events.service';

export interface CommitSkillAction {
  type: LearningCommitType;
  skillName?: string;
  message?: string;
  delta?: number;
  masteryPct?: number;
  payload?: Record<string, any>;
  source?: 'self_report' | 'conversation' | 'github' | 'exam';
  trustWeight?: number;
}

@Injectable()
export class LearningCommitService {
  constructor(
    @InjectRepository(LearningBranch) private readonly branchRepo: Repository<LearningBranch>,
    @InjectRepository(LearningCommit) private readonly commitRepo: Repository<LearningCommit>,
    private readonly skillService: SkillService,
    private readonly snapshotService: SkillSnapshotService,
    private readonly matchAgentService: MatchAgentService,
    private readonly eventsService: EventsService,
  ) {}

  async ensureMainBranch(userId: number, tenantId = 1): Promise<LearningBranch> {
    let branch = await this.branchRepo.findOne({
      where: { userId, tenantId, branchType: 'main', status: 1 },
      order: { id: 'ASC' },
    });
    if (branch) return branch;

    const now = Date.now();
    branch = await this.branchRepo.save({
      userId,
      tenantId,
      branchName: 'main',
      branchType: 'main',
      planId: null,
      baseCommitId: null,
      headCommitId: null,
      sourceBranchId: null,
      mergedAt: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const commit = await this.commitRepo.save({
      userId,
      tenantId,
      branchId: branch.id,
      parentCommitId: null,
      mergeSourceCommitId: null,
      commitType: 'baseline',
      skillName: null,
      message: 'baseline',
      payloadJson: { initialized: true },
      snapshotId: null,
      deltaJson: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
    const skills = await this.skillService.getEffectiveSkills(userId, tenantId);
    const snapshot = await this.snapshotService.saveSnapshot({
      userId,
      branchId: branch.id,
      commitId: commit.id,
      tenantId,
      skills,
      previous: null,
      matchSummary: null,
    });
    commit.snapshotId = snapshot.id;
    commit.deltaJson = this.snapshotService.calculateDelta(null, snapshot, 0);
    commit.updateTime = Date.now();
    await this.commitRepo.save(commit);

    branch.baseCommitId = commit.id;
    branch.headCommitId = commit.id;
    branch.updateTime = Date.now();
    return this.branchRepo.save(branch);
  }

  async listLog(userId: number, branchId: number, limit = 50, tenantId = 1): Promise<LearningCommit[]> {
    await this.assertBranch(userId, branchId, tenantId);
    return this.commitRepo.find({
      where: { userId, tenantId, branchId, status: 1 },
      order: { createTime: 'DESC', id: 'DESC' },
      take: Math.max(1, Math.min(200, limit)),
    });
  }

  async getCommit(userId: number, commitId: number, tenantId = 1): Promise<LearningCommit> {
    const commit = await this.commitRepo.findOne({ where: { id: commitId, userId, tenantId, status: 1 } });
    if (!commit) throw new NotFoundException('commit not found');
    return commit;
  }

  async commitSkill(userId: number, branchId: number | undefined, action: CommitSkillAction, tenantId = 1) {
    const branch = branchId
      ? await this.assertBranch(userId, branchId, tenantId)
      : await this.ensureMainBranch(userId, tenantId);
    const parentCommitId = branch.headCommitId || null;
    const previousSnapshot = parentCommitId
      ? await this.snapshotService.getSnapshotByCommit(userId, parentCommitId, tenantId)
      : await this.snapshotService.getLatestSnapshot(userId, branch.id, tenantId);
    const beforeBest = this.bestMatchScore(previousSnapshot?.matchSummaryJson);

    const affectsAbilityMain = branch.branchType === 'main';
    if (affectsAbilityMain) await this.applySkillAction(userId, action, tenantId);

    const now = Date.now();
    const commit = await this.commitRepo.save({
      userId,
      tenantId,
      branchId: branch.id,
      parentCommitId,
      mergeSourceCommitId: null,
      commitType: action.type || 'manual',
      skillName: action.skillName || null,
      message: action.message || this.defaultMessage(action),
      payloadJson: action.payload || null,
      snapshotId: null,
      deltaJson: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const matchSummary = affectsAbilityMain
      ? await this.calculateMatchSummary(userId, tenantId)
      : (previousSnapshot?.matchSummaryJson || null);
    const afterBest = this.bestMatchScore(matchSummary);
    const skills = affectsAbilityMain
      ? await this.skillService.getEffectiveSkills(userId, tenantId)
      : await this.applySkillActionToSnapshot(userId, previousSnapshot, action, tenantId);
    const velocity = await this.calculateVelocity(userId, branch.id, tenantId);
    const snapshot = await this.snapshotService.saveSnapshot({
      userId,
      branchId: branch.id,
      commitId: commit.id,
      tenantId,
      skills,
      previous: previousSnapshot,
      matchSummary,
      learningSpeed: velocity.learningSpeed,
      consistency: velocity.consistency,
    });
    const delta = this.snapshotService.calculateDelta(previousSnapshot, snapshot, afterBest - beforeBest);

    commit.snapshotId = snapshot.id;
    commit.deltaJson = delta as any;
    commit.updateTime = Date.now();
    await this.commitRepo.save(commit);

    branch.headCommitId = commit.id;
    branch.updateTime = Date.now();
    await this.branchRepo.save(branch);

    this.emitCommitEvents(userId, branch, commit, snapshot, delta, matchSummary, tenantId);
    this.emitMatchChangeIfAny(userId, branch, delta, matchSummary, beforeBest, afterBest, tenantId);

    return { commit, snapshot, delta, branch, matchSummary };
  }

  async createCommitFromCurrentSkills(input: {
    userId: number;
    tenantId?: number;
    branch: LearningBranch;
    commitType: LearningCommitType;
    message: string;
    payload?: Record<string, any>;
    mergeSourceCommitId?: number | null;
  }) {
    const tenantId = input.tenantId ?? 1;
    const parentCommitId = input.branch.headCommitId || null;
    const previousSnapshot = parentCommitId
      ? await this.snapshotService.getSnapshotByCommit(input.userId, parentCommitId, tenantId)
      : null;
    const beforeBest = this.bestMatchScore(previousSnapshot?.matchSummaryJson);
    const now = Date.now();
    const commit = await this.commitRepo.save({
      userId: input.userId,
      tenantId,
      branchId: input.branch.id,
      parentCommitId,
      mergeSourceCommitId: input.mergeSourceCommitId || null,
      commitType: input.commitType,
      skillName: null,
      message: input.message,
      payloadJson: input.payload || null,
      snapshotId: null,
      deltaJson: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
    const matchSummary = await this.calculateMatchSummary(input.userId, tenantId);
    const skills = await this.skillService.getEffectiveSkills(input.userId, tenantId);
    const snapshot = await this.snapshotService.saveSnapshot({
      userId: input.userId,
      branchId: input.branch.id,
      commitId: commit.id,
      tenantId,
      skills,
      previous: previousSnapshot,
      matchSummary,
    });
    const delta = this.snapshotService.calculateDelta(previousSnapshot, snapshot, this.bestMatchScore(matchSummary) - beforeBest);
    commit.snapshotId = snapshot.id;
    commit.deltaJson = delta as any;
    commit.updateTime = Date.now();
    await this.commitRepo.save(commit);
    input.branch.headCommitId = commit.id;
    input.branch.updateTime = Date.now();
    await this.branchRepo.save(input.branch);
    this.emitCommitEvents(input.userId, input.branch, commit, snapshot, delta, matchSummary, tenantId);
    this.emitMatchChangeIfAny(input.userId, input.branch, delta, matchSummary, beforeBest, this.bestMatchScore(matchSummary), tenantId);
    return { commit, snapshot, delta, branch: input.branch, matchSummary };
  }

  private async assertBranch(userId: number, branchId: number, tenantId = 1): Promise<LearningBranch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, userId, tenantId, status: 1 } });
    if (!branch) throw new NotFoundException('branch not found');
    return branch;
  }

  private async applySkillAction(userId: number, action: CommitSkillAction, tenantId = 1) {
    const skillName = action.skillName?.trim();
    if (!skillName) return;
    const source = action.source || 'exam';
    const trustWeight = action.trustWeight ?? 0.7;
    const existing = await this.skillService.getSkill(userId, skillName, tenantId);
    if (!existing) {
      if (tenantId === 1) await this.skillService.addSkill(userId, skillName, source, trustWeight, 0);
      else await this.skillService.addSkill(userId, skillName, source, trustWeight, 0, tenantId);
    }
    if (action.masteryPct !== undefined) {
      const updated = tenantId === 1
        ? await this.skillService.setMastery(userId, skillName, action.masteryPct)
        : await this.skillService.setMastery(userId, skillName, action.masteryPct, 0.9, tenantId);
      if (!updated) {
        if (tenantId === 1) await this.skillService.addSkill(userId, skillName, source, trustWeight, action.masteryPct);
        else await this.skillService.addSkill(userId, skillName, source, trustWeight, action.masteryPct, tenantId);
      }
    } else if (action.delta !== undefined) {
      const updated = tenantId === 1
        ? await this.skillService.updateMastery(userId, skillName, action.delta)
        : await this.skillService.updateMastery(userId, skillName, action.delta, tenantId);
      if (!updated) {
        if (tenantId === 1) await this.skillService.addSkill(userId, skillName, source, trustWeight, action.delta);
        else await this.skillService.addSkill(userId, skillName, source, trustWeight, action.delta, tenantId);
      }
    }
  }

  private async applySkillActionToSnapshot(userId: number, previousSnapshot: any, action: CommitSkillAction, tenantId = 1) {
    const sourceSkills = previousSnapshot?.skillsJson?.length
      ? previousSnapshot.skillsJson
      : await this.skillService.getEffectiveSkills(userId, tenantId);
    const skills = this.snapshotService.normalizeSkills(sourceSkills).map((skill) => ({ ...skill }));
    const skillName = action.skillName?.trim();
    if (!skillName || (action.delta === undefined && action.masteryPct === undefined)) return skills;

    let skill = skills.find((item) => item.name.toLowerCase() === skillName.toLowerCase());
    if (!skill) {
      skill = {
        name: skillName,
        category: 'other',
        mastery: 0,
        source: action.source || 'exam',
        trustWeight: action.trustWeight ?? 0.7,
        effectiveMastery: 0,
        decayRate: 0.5,
      };
      skills.push(skill);
    }
    const nextMastery = action.masteryPct !== undefined
      ? action.masteryPct
      : Number(skill.mastery || 0) + Number(action.delta || 0);
    skill.mastery = Math.max(0, Math.min(100, nextMastery));
    skill.source = action.source || skill.source;
    skill.trustWeight = action.trustWeight ?? skill.trustWeight ?? 0.7;
    skill.effectiveMastery = skill.mastery * skill.trustWeight;
    skill.lastUpdated = Date.now();
    return skills;
  }

  private async calculateMatchSummary(userId: number, tenantId = 1) {
    const results = tenantId === 1
      ? await this.matchAgentService.calculateForAllJobs(userId, 'learning_commit')
      : await this.matchAgentService.calculateForAllJobs(userId, 'learning_commit', tenantId);
    return {
      best: results[0] || null,
      jobs: results,
      calculatedAt: Date.now(),
    };
  }

  private bestMatchScore(summary: any): number {
    return Number(summary?.best?.matchScore || 0);
  }

  private async calculateVelocity(userId: number, branchId: number, tenantId = 1) {
    const since = Date.now() - 14 * 86400000;
    const commits = await this.commitRepo.find({
      where: { userId, tenantId, branchId, status: 1 },
      order: { createTime: 'DESC' },
      take: 100,
    });
    const recent = commits.filter((c) => Number(c.createTime || 0) >= since && c.commitType !== 'baseline');
    const days = new Set(recent.map((c) => new Date(Number(c.createTime)).toISOString().slice(0, 10)));
    return {
      learningSpeed: Math.min(100, recent.length * 8),
      consistency: Math.round((days.size / 14) * 100),
    };
  }

  private defaultMessage(action: CommitSkillAction): string {
    if (!action.skillName) return action.type;
    return `${action.type}: ${action.skillName}`;
  }

  private emitCommitEvents(userId: number, branch: LearningBranch, commit: LearningCommit, snapshot: any, delta: any, matchSummary: any, tenantId = 1) {
    const emit = (event: { type: string; data: any }) => tenantId === 1
      ? this.eventsService.emit(userId, event)
      : this.eventsService.emit(userId, event, tenantId);
    emit({ type: 'commit_created', data: { commit, delta, branch } });
    emit({ type: 'branch_updated', data: { branch } });
    if (branch.branchType === 'main') {
      emit({ type: 'radar_updated', data: { snapshot, radar: snapshot.radarJson, abilityMetrics: snapshot.abilityMetricsJson } });
      emit({ type: 'match_updated', data: matchSummary });
    }
  }

  /**
   * P0-3：主分支 commit 后若最佳岗位匹配度发生变化，
   * 推送 match_update 事件（首页 SSE toast 据此弹出"匹配度变化提示"），
   * 并附带可读变化原因（来自 skill delta）。
   */
  private emitMatchChangeIfAny(userId: number, branch: LearningBranch, delta: any, matchSummary: any, beforeBest: number, afterBest: number, tenantId = 1) {
    if (branch.branchType !== 'main') return;
    const best = matchSummary?.best;
    if (!best) return;
    const diff = Math.round((afterBest - beforeBest) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;

    const changes = (delta?.skillChanges || [])
      .filter((c: any) => Math.abs(c.delta) > 0.5)
      .slice(0, 3)
      .map((c: any) => `${c.name} ${c.delta > 0 ? '+' : ''}${this.round1(c.delta)}%`);
    const direction = diff > 0 ? '提升' : '下降';
    const reason = changes.length > 0
      ? `${changes.join('、')}，${best.jobTitle}匹配度${direction} ${this.round1(beforeBest)}% → ${this.round1(afterBest)}%`
      : `${best.jobTitle}匹配度${direction} ${this.round1(beforeBest)}% → ${this.round1(afterBest)}%`;

    if (tenantId === 1) this.eventsService.emitMatchUpdate(userId, best.jobId, best.matchScore, reason);
    else this.eventsService.emitMatchUpdate(userId, best.jobId, best.matchScore, reason, tenantId);
  }

  private round1(v: number): number {
    return Math.round(Number(v || 0) * 10) / 10;
  }
}
