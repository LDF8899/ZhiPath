import type { Job } from '../types';

export type JobTrustKind = 'platform' | 'enterprise' | 'web' | 'ai';

export interface JobTrustTier {
  kind: JobTrustKind;
  label: string;
  badgeClass: string;
  description: string;
  canDirectApply: boolean;
  canUseAsLearningTarget: boolean;
}

export function getJobTrustTier(job: Job): JobTrustTier {
  const isOnline = Number(job.id) < 0 || job.source === 'online' || job.searchMeta?.source === 'online';
  const isAiGenerated = isOnline && (job.searchMeta?.origin === 'ai_generated' || !job.url);

  if (isAiGenerated) {
    return {
      kind: 'ai',
      label: 'AI 参考岗位',
      badgeClass: 'hd-badge red',
      description: '由 AI 根据市场常识补充，仅用于方向探索和学习目标参考。',
      canDirectApply: false,
      canUseAsLearningTarget: true,
    };
  }

  if (isOnline) {
    return {
      kind: 'web',
      label: '联网参考岗位',
      badgeClass: 'hd-badge accent',
      description: '来自公开网页摘要，请以来源页面的最新信息为准。',
      canDirectApply: false,
      canUseAsLearningTarget: true,
    };
  }

  if (job.enterpriseId || job.source === 'enterprise') {
    return {
      kind: 'enterprise',
      label: '企业认证岗位',
      badgeClass: 'hd-badge green',
      description: '来自平台企业信息，可用于匹配分析、简历生成和投递。',
      canDirectApply: true,
      canUseAsLearningTarget: true,
    };
  }

  return {
    kind: 'platform',
    label: '平台岗位',
    badgeClass: 'hd-badge',
    description: '来自平台岗位库，可用于匹配分析、简历生成和投递。',
    canDirectApply: true,
    canUseAsLearningTarget: true,
  };
}

export function getJobSkillNames(job: Job): string[] {
  return Array.from(new Set([
    ...(job.requiredSkills || []).map((skill) => skill.name),
    ...(job.preferredSkills || []).map((skill) => skill.name),
  ].filter(Boolean)));
}
