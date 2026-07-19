import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningBranch, LearningBranchType } from '../entities/learning-branch.entity';
import { LearningCommit } from '../entities/learning-commit.entity';
import { UserSkill } from '../entities/user-skills.entity';
import { SkillSnapshotV3 } from '../entities/skill-snapshot-v3.entity';
import { SkillSnapshotService, SkillDimension } from './skill-snapshot.service';
import { SkillService } from './skill.service';
import { LearningCommitService } from './learning-commit.service';
import { EventsService } from '../modules/events/events.service';
import { LearningPlan } from '../entities/learning.entity';

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(LearningBranch) private readonly branchRepo: Repository<LearningBranch>,
    @InjectRepository(LearningCommit) private readonly commitRepo: Repository<LearningCommit>,
    @InjectRepository(LearningPlan) private readonly planRepo: Repository<LearningPlan>,
    private readonly snapshotService: SkillSnapshotService,
    private readonly skillService: SkillService,
    private readonly learningCommitService: LearningCommitService,
    private readonly eventsService: EventsService,
  ) {}

  async listBranches(userId: number): Promise<LearningBranch[]> {
    await this.learningCommitService.ensureMainBranch(userId);
    return this.branchRepo.find({
      where: { userId, status: 1 },
      order: { branchType: 'ASC', createTime: 'ASC' },
    });
  }

  async createBranch(userId: number, input: { branchName?: string; branchType?: LearningBranchType; sourceBranchId?: number; planId?: number }) {
    if (input.planId) {
      const plan = await this.planRepo.findOne({ where: { id: input.planId, userId, status: 1 } });
      if (!plan) throw new NotFoundException('plan not found');
      const existing = await this.branchRepo.findOne({ where: { userId, planId: plan.id, status: 1 } });
      if (existing) return existing;
    }
    const source = input.sourceBranchId
      ? await this.getBranch(userId, input.sourceBranchId)
      : await this.learningCommitService.ensureMainBranch(userId);
    const now = Date.now();
    const branch = await this.branchRepo.save({
      userId,
      branchName: input.branchName || `${input.branchType || 'side'}-${now}`,
      branchType: input.planId ? 'plan' : input.branchType || 'side',
      planId: input.planId || null,
      baseCommitId: source.headCommitId || source.baseCommitId || null,
      headCommitId: source.headCommitId || source.baseCommitId || null,
      sourceBranchId: source.id,
      mergedAt: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
    return branch;
  }

  async ensurePlanBranch(userId: number, planOrId: LearningPlan | number): Promise<LearningBranch> {
    const plan = typeof planOrId === 'number'
      ? await this.planRepo.findOne({ where: { id: planOrId, userId, status: 1 } })
      : planOrId;
    if (!plan || Number(plan.userId) !== Number(userId)) throw new NotFoundException('plan not found');
    const existing = await this.branchRepo.findOne({ where: { userId, planId: plan.id, status: 1 } });
    if (existing) return existing;
    return this.createBranch(userId, {
      planId: plan.id,
      branchType: 'plan',
      branchName: `plan/${plan.id}-${plan.planName}`.slice(0, 120),
    });
  }

  async getPlanBranch(userId: number, planId: number): Promise<LearningBranch> {
    return this.ensurePlanBranch(userId, planId);
  }

  async compareBranches(userId: number, sourceId: number, targetId: number) {
    const source = await this.getBranch(userId, sourceId);
    const target = await this.getBranch(userId, targetId);
    const sourceSnapshot = source.headCommitId ? await this.snapshotService.getSnapshotByCommit(userId, source.headCommitId) : null;
    const targetSnapshot = target.headCommitId ? await this.snapshotService.getSnapshotByCommit(userId, target.headCommitId) : null;
    if (!sourceSnapshot || !targetSnapshot) {
      return { source, target, sourceSnapshot, targetSnapshot, delta: null };
    }
    return {
      source,
      target,
      sourceSnapshot,
      targetSnapshot,
      delta: this.snapshotService.calculateDelta(targetSnapshot, sourceSnapshot, 0),
    };
  }

  async mergeBranch(userId: number, sourceId: number, targetId?: number) {
    const source = await this.getBranch(userId, sourceId);
    const target = targetId ? await this.getBranch(userId, targetId) : await this.learningCommitService.ensureMainBranch(userId);
    if (source.id === target.id) throw new Error('source and target branch must be different');
    if (target.branchType !== 'main') throw new Error('verified ability can only merge into the ability main branch');
    const sourceHead = source.headCommitId ? await this.snapshotService.getSnapshotByCommit(userId, source.headCommitId) : null;
    if (!sourceHead) throw new NotFoundException('source snapshot not found');
    const base = source.baseCommitId ? await this.snapshotService.getSnapshotByCommit(userId, source.baseCommitId) : null;
    const targetHead = target.headCommitId ? await this.snapshotService.getSnapshotByCommit(userId, target.headCommitId) : null;

    await this.applySnapshotGain(userId, base, sourceHead);

    const result = await this.learningCommitService.createCommitFromCurrentSkills({
      userId,
      branch: target,
      commitType: 'merge',
      message: `merge ${source.branchName} into ${target.branchName}`,
      mergeSourceCommitId: source.headCommitId,
      payload: { sourceBranchId: source.id, targetBranchId: target.id, sourceHeadCommitId: source.headCommitId },
    });

    source.mergedAt = Date.now();
    source.updateTime = Date.now();
    await this.branchRepo.save(source);
    return result;
  }

  async rollback(userId: number, commitId: number) {
    const commit = await this.learningCommitService.getCommit(userId, commitId);
    const branch = await this.getBranch(userId, commit.branchId);
    const snapshot = await this.snapshotService.getSnapshotByCommit(userId, commit.id);
    if (!snapshot) throw new NotFoundException('snapshot not found');
    branch.headCommitId = commit.id;
    branch.updateTime = Date.now();
    await this.branchRepo.save(branch);
    this.eventsService.emit(userId, { type: 'branch_updated', data: { branch } });
    return { branch, commit, snapshot, nonDestructive: true };
  }

  async getCommitDetail(userId: number, commitId: number) {
    const commit = await this.learningCommitService.getCommit(userId, commitId);
    const snapshot = commit.snapshotId ? await this.snapshotService.getSnapshot(userId, commit.snapshotId) : null;
    return { commit, snapshot };
  }

  private async getBranch(userId: number, branchId: number): Promise<LearningBranch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, userId, status: 1 } });
    if (!branch) throw new NotFoundException('branch not found');
    return branch;
  }

  private async applySnapshotGain(userId: number, base: SkillSnapshotV3 | null, source: SkillSnapshotV3) {
    const baseSkills = new Map<string, SkillDimension>();
    for (const skill of ((base?.skillsJson || []) as SkillDimension[])) {
      baseSkills.set(skill.name.toLowerCase(), skill);
    }
    for (const skill of ((source.skillsJson || []) as SkillDimension[])) {
      const before = baseSkills.get(skill.name.toLowerCase());
      const gain = Math.max(0, Number(skill.mastery || 0) - Number(before?.mastery || 0));
      if (gain <= 0) continue;
      const existing = await this.skillService.getSkill(userId, skill.name);
      if (!existing) {
        await this.skillService.addSkill(userId, skill.name, this.normalizeSource(skill.source), Number(skill.trustWeight || 0.7), gain);
      } else {
        await this.skillService.updateMastery(userId, skill.name, gain);
      }
    }
  }

  private normalizeSource(source: string): UserSkill['source'] {
    if (source === 'conversation' || source === 'github' || source === 'exam' || source === 'self_report') return source;
    return 'exam';
  }
}
