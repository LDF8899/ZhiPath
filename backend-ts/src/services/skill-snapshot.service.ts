import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillSnapshotV3 } from '../entities/skill-snapshot-v3.entity';

export interface SkillDimension {
  name: string;
  category: string;
  mastery: number;
  source: string;
  trustWeight: number;
  effectiveMastery: number;
  lastUpdated?: number;
  decayRate: number;
}

export interface RadarDimension {
  name: string;
  category: string;
  skills: string[];
  score: number;
  trend: 'up' | 'down' | 'stable';
  lastCommitId?: number | null;
}

export interface AbilityMetrics {
  overallScore: number;
  frontendScore: number;
  backendScore: number;
  toolingScore: number;
  softSkillScore: number;
  depth: number;
  breadth: number;
  balance: number;
  learningSpeed: number;
  consistency: number;
}

export interface CommitDelta {
  skillChanges: Array<{ name: string; before: number; after: number; delta: number }>;
  metricsChange: {
    overallScore: number;
    matchScore: number;
    depthScore: number;
    breadthScore: number;
  };
  radarChanges: Array<{ dimension: string; before: number; after: number; delta: number }>;
}

export const RADAR_DIMENSIONS = [
  { name: '\u524d\u7aef\u57fa\u7840', category: 'frontend', skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript'], weight: 0.25 },
  { name: '\u524d\u7aef\u6846\u67b6', category: 'framework', skills: ['React', 'Vue', 'Angular', 'Next.js'], weight: 0.2 },
  { name: '\u72b6\u6001\u7ba1\u7406', category: 'state', skills: ['Redux', 'Zustand', 'MobX', 'Context API'], weight: 0.15 },
  { name: '\u5de5\u7a0b\u5316', category: 'tooling', skills: ['Webpack', 'Vite', 'Git', 'GitHub', 'CI/CD', 'Docker'], weight: 0.15 },
  { name: 'CSS/\u5e03\u5c40', category: 'css', skills: ['CSS', 'Flexbox', 'Grid', 'Tailwind', 'Sass'], weight: 0.1 },
  { name: '\u540e\u7aef\u57fa\u7840', category: 'backend', skills: ['Node.js', 'Express', 'NestJS', '\u6570\u636e\u5e93', 'MySQL', 'MongoDB', 'API\u8bbe\u8ba1'], weight: 0.15 },
];

@Injectable()
export class SkillSnapshotService {
  constructor(
    @InjectRepository(SkillSnapshotV3)
    private readonly snapshotRepo: Repository<SkillSnapshotV3>,
  ) {}

  async saveSnapshot(input: {
    userId: number;
    branchId: number;
    commitId: number;
    skills: any[];
    previous?: SkillSnapshotV3 | null;
    matchSummary?: Record<string, any> | null;
    learningSpeed?: number;
    consistency?: number;
  }): Promise<SkillSnapshotV3> {
    const skills = this.normalizeSkills(input.skills);
    const previousRadar = (input.previous?.radarJson || []) as RadarDimension[];
    const radar = this.calculateRadarData(skills, previousRadar, input.commitId);
    const abilityMetrics = this.calculateAbilityMetrics(skills, radar, input.learningSpeed || 0, input.consistency || 0);

    return this.snapshotRepo.save({
      userId: input.userId,
      branchId: input.branchId,
      commitId: input.commitId,
      skillsJson: skills,
      radarJson: radar,
      abilityMetricsJson: abilityMetrics,
      matchSummaryJson: input.matchSummary || null,
      totalMastery: abilityMetrics.overallScore,
      skillCount: skills.length,
      depthScore: abilityMetrics.depth,
      breadthScore: abilityMetrics.breadth,
      balanceScore: abilityMetrics.balance,
      createTime: Date.now(),
      updateTime: Date.now(),
      status: 1,
    });
  }

  async getLatestSnapshot(userId: number, branchId?: number): Promise<SkillSnapshotV3 | null> {
    const where: any = { userId, status: 1 };
    if (branchId) where.branchId = branchId;
    return this.snapshotRepo.findOne({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
    });
  }

  async listSnapshots(userId: number, branchId?: number, limit = 30): Promise<SkillSnapshotV3[]> {
    const where: any = { userId, status: 1 };
    if (branchId) where.branchId = branchId;
    return this.snapshotRepo.find({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      take: Math.max(1, Math.min(100, limit)),
    });
  }

  async getSnapshot(userId: number, snapshotId: number): Promise<SkillSnapshotV3 | null> {
    return this.snapshotRepo.findOne({ where: { id: snapshotId, userId, status: 1 } });
  }

  async getSnapshotByCommit(userId: number, commitId: number): Promise<SkillSnapshotV3 | null> {
    return this.snapshotRepo.findOne({ where: { commitId, userId, status: 1 } });
  }

  calculateDelta(before: SkillSnapshotV3 | null | undefined, after: SkillSnapshotV3, matchDelta = 0): CommitDelta {
    const beforeSkills = new Map<string, number>();
    for (const s of ((before?.skillsJson || []) as SkillDimension[])) {
      beforeSkills.set(this.key(s.name), Number(s.effectiveMastery) || Number(s.mastery) || 0);
    }

    const skillChanges = ((after.skillsJson || []) as SkillDimension[])
      .map((skill) => {
        const prev = beforeSkills.get(this.key(skill.name)) || 0;
        const next = Number(skill.effectiveMastery) || Number(skill.mastery) || 0;
        return {
          name: skill.name,
          before: this.round(prev),
          after: this.round(next),
          delta: this.round(next - prev),
        };
      })
      .filter((c) => Math.abs(c.delta) > 0.01);

    const beforeRadar = new Map<string, number>();
    for (const r of ((before?.radarJson || []) as RadarDimension[])) {
      beforeRadar.set(r.name, Number(r.score) || 0);
    }

    const radarChanges = ((after.radarJson || []) as RadarDimension[])
      .map((dim) => {
        const prev = beforeRadar.get(dim.name) || 0;
        const next = Number(dim.score) || 0;
        return {
          dimension: dim.name,
          before: this.round(prev),
          after: this.round(next),
          delta: this.round(next - prev),
        };
      })
      .filter((c) => Math.abs(c.delta) > 0.01);

    return {
      skillChanges,
      metricsChange: {
        overallScore: this.round(Number(after.totalMastery || 0) - Number(before?.totalMastery || 0)),
        matchScore: this.round(matchDelta),
        depthScore: this.round(Number(after.depthScore || 0) - Number(before?.depthScore || 0)),
        breadthScore: this.round(Number(after.breadthScore || 0) - Number(before?.breadthScore || 0)),
      },
      radarChanges,
    };
  }

  compareSnapshots(before: SkillSnapshotV3, after: SkillSnapshotV3) {
    return {
      before,
      after,
      delta: this.calculateDelta(before, after, 0),
    };
  }

  normalizeSkills(rawSkills: any[]): SkillDimension[] {
    return (rawSkills || [])
      .filter((s) => s?.name || s?.skillName)
      .map((s) => {
        const name = String(s.name || s.skillName).trim();
        const mastery = Number(s.masteryPct ?? s.mastery ?? 0);
        const trustWeight = Number(s.trustWeight ?? s.trust_weight ?? 1);
        const effectiveMastery = Number(s.effectiveScore ?? s.effectiveMastery ?? mastery * trustWeight);
        return {
          name,
          category: s.category || this.categoryOf(name),
          mastery: this.round(mastery),
          source: s.source || 'manual',
          trustWeight: this.round(trustWeight),
          effectiveMastery: this.round(effectiveMastery),
          lastUpdated: Number(s.lastActivity || s.lastUpdated || 0) || undefined,
          decayRate: Number(s.decayRate || 0.5),
        };
      })
      .sort((a, b) => b.effectiveMastery - a.effectiveMastery || a.name.localeCompare(b.name));
  }

  calculateRadarData(skills: SkillDimension[], previousRadar: RadarDimension[] = [], commitId?: number): RadarDimension[] {
    const skillMap = new Map(skills.map((s) => [this.key(s.name), s]));
    const previous = new Map(previousRadar.map((r) => [r.name, r.score]));

    return RADAR_DIMENSIONS.map((dim) => {
      const matched = dim.skills
        .map((name) => skillMap.get(this.key(name)))
        .filter(Boolean) as SkillDimension[];
      const score = matched.length
        ? this.round(matched.reduce((sum, s) => sum + s.effectiveMastery, 0) / matched.length)
        : 0;
      const prev = previous.get(dim.name);
      const diff = prev === undefined ? score : score - prev;
      return {
        name: dim.name,
        category: dim.category,
        skills: dim.skills,
        score,
        trend: Math.abs(diff) < 0.01 ? 'stable' : diff > 0 ? 'up' : 'down',
        lastCommitId: Math.abs(diff) > 0.01 ? commitId || null : null,
      };
    });
  }

  calculateAbilityMetrics(skills: SkillDimension[], radar: RadarDimension[], learningSpeed = 0, consistency = 0): AbilityMetrics {
    const scores = radar.map((r) => Number(r.score) || 0);
    const overall = scores.length
      ? this.round(radar.reduce((sum, dim) => {
        const config = RADAR_DIMENSIONS.find((d) => d.name === dim.name);
        return sum + dim.score * (config?.weight || 0);
      }, 0))
      : 0;
    const frontendScore = this.averageByCategory(radar, ['frontend', 'framework', 'state', 'css']);
    const backendScore = this.averageByCategory(radar, ['backend']);
    const toolingScore = this.averageByCategory(radar, ['tooling']);
    const depth = skills.length ? Math.max(...skills.map((s) => Number(s.effectiveMastery) || 0)) : 0;
    const breadth = scores.length ? Math.round((scores.filter((s) => s > 0).length / scores.length) * 100) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const min = scores.length ? Math.min(...scores) : 0;
    const balance = scores.length ? Math.max(0, this.round(100 - (max - min))) : 0;

    return {
      overallScore: overall,
      frontendScore,
      backendScore,
      toolingScore,
      softSkillScore: this.estimateSoftSkillScore(skills),
      depth: this.round(depth),
      breadth,
      balance,
      learningSpeed: this.round(learningSpeed),
      consistency: this.round(consistency),
    };
  }

  private averageByCategory(radar: RadarDimension[], categories: string[]): number {
    const dims = radar.filter((r) => categories.includes(r.category));
    if (!dims.length) return 0;
    return this.round(dims.reduce((sum, r) => sum + r.score, 0) / dims.length);
  }

  private estimateSoftSkillScore(skills: SkillDimension[]): number {
    const names = ['\u6c9f\u901a\u80fd\u529b', '\u56e2\u961f\u534f\u4f5c', 'Code Review', '\u9879\u76ee\u7ba1\u7406', '\u95ee\u9898\u89e3\u51b3'];
    const matched = skills.filter((s) => names.some((n) => this.key(s.name).includes(this.key(n))));
    if (!matched.length) return 0;
    return this.round(matched.reduce((sum, s) => sum + s.effectiveMastery, 0) / matched.length);
  }

  private categoryOf(name: string): string {
    const key = this.key(name);
    const dim = RADAR_DIMENSIONS.find((d) => d.skills.some((skill) => this.key(skill) === key));
    return dim?.category || 'other';
  }

  private key(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private round(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
