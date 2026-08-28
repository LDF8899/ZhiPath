import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningPlan } from '../entities/learning.entity';
import { LearningDomainRegistry } from './learning-domain.registry';
import type { LearningGoalType } from './learning-domain.types';

export interface MaterializedRadarDimension {
  id: string;
  name: string;
  category: string;
  skills: string[];
  weight: number;
}

export interface LearningAssessmentContext {
  planId: number;
  domainId: string;
  domainName: string;
  goalType: LearningGoalType;
  goalTitle: string;
  passScore: number;
  assessmentModes: string[];
  evidenceTypes: string[];
  terminology: Record<string, string>;
  radarDimensions: MaterializedRadarDimension[];
  currentAbilityName?: string;
}

@Injectable()
export class LearningAssessmentContextService {
  constructor(
    @InjectRepository(LearningPlan) private readonly planRepo: Repository<LearningPlan>,
    private readonly domainRegistry: LearningDomainRegistry,
  ) {}

  async resolve(userId: number): Promise<LearningAssessmentContext | null> {
    const plan = await this.planRepo.findOne({
      where: { userId, status: 1, planStatus: 'active', planType: 'main' },
      order: { createTime: 'DESC', id: 'DESC' },
    });
    if (!plan) return null;

    return this.fromPlan(plan);
  }

  fromPlan(plan: LearningPlan): LearningAssessmentContext {
    const domain = this.domainRegistry.get(plan.domainId || 'software-engineering');
    const pathData = plan.pathData || {};
    const phases = Array.isArray(pathData.phases) ? pathData.phases : [];
    const abilityNames = new Map<string, string>();
    for (const phase of phases) {
      for (const skill of phase.skills || []) {
        if (skill.abilityId) abilityNames.set(String(skill.abilityId), String(skill.name));
      }
    }

    const dimensionDefinitions = Array.isArray(pathData.radarDimensions)
      ? pathData.radarDimensions
      : domain.radarDimensions;
    const configuredDimensions = (dimensionDefinitions || []).map((dimension: any) => ({
      id: dimension.id,
      name: dimension.name,
      category: `${domain.id}:${dimension.id}`,
      skills: (dimension.abilityIds || []).map((id: string) => abilityNames.get(id)).filter(Boolean) as string[],
      weight: dimension.weight,
    }));
    const radarDimensions = configuredDimensions.some((dimension) => dimension.skills.length > 0)
      ? configuredDimensions
      : this.dimensionsFromPhases(domain.id, phases);
    const currentPhase = phases[Number(plan.currentPhase || 0)] || phases[0];
    const currentAbility = (currentPhase?.skills || []).find((skill: any) => skill.status !== 'done')
      || currentPhase?.skills?.[0];

    return {
      planId: plan.id,
      domainId: domain.id,
      domainName: domain.name,
      goalType: plan.goalType,
      goalTitle: plan.goalTitle || plan.planName,
      passScore: Number(pathData.passScore || domain.passScore || 70),
      assessmentModes: pathData.assessmentModes || domain.assessmentModes,
      evidenceTypes: pathData.evidenceTypes || domain.evidenceTypes,
      terminology: pathData.terminology || domain.terminology,
      radarDimensions,
      currentAbilityName: currentAbility?.name,
    };
  }

  dimensionForSkill(context: LearningAssessmentContext | null, skillName?: string): MaterializedRadarDimension | null {
    if (!context) return null;
    const target = this.key(skillName || context.currentAbilityName || '');
    return context.radarDimensions.find((dimension) => (
      dimension.skills.some((skill) => this.key(skill) === target)
    )) || null;
  }

  rubricKey(context: LearningAssessmentContext | null, attemptType: string): string {
    const domainId = context?.domainId || 'general';
    return `${this.key(domainId)}_${this.key(attemptType)}_v1`;
  }

  private dimensionsFromPhases(domainId: string, phases: any[]): MaterializedRadarDimension[] {
    const count = Math.max(1, phases.length);
    return phases.map((phase, index) => ({
      id: `phase-${index + 1}`,
      name: phase.name || `阶段 ${index + 1}`,
      category: `${domainId}:phase-${index + 1}`,
      skills: (phase.skills || []).map((skill: any) => String(skill.name)).filter(Boolean),
      weight: 1 / count,
    }));
  }

  private key(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '');
  }
}
