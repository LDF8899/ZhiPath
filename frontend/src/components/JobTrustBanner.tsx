import type { JobTrustTier } from '../utils/jobTrust';
import { IconBook, IconBriefcase, IconDocument, IconSend, IconTarget } from './icons';

function actionSummary(tier: JobTrustTier) {
  if (!tier.canDirectApply) {
    return tier.kind === 'ai'
      ? '仅建议用于方向探索和补技能，不进入投递流程。'
      : '可作为学习目标，投递前请打开来源页面确认岗位仍有效。';
  }
  return '可用于匹配分析、岗位版简历生成和平台投递。';
}

export default function JobTrustBanner({
  tier,
  host,
  compact = false,
}: {
  tier: JobTrustTier;
  host?: string;
  compact?: boolean;
}) {
  const sourceText = host && tier.kind === 'web' ? `来源：${host}` : tier.description;
  return (
    <div className={`job-trust-banner ${tier.kind} ${compact ? 'compact' : ''}`}>
      <div className="job-trust-main">
        <span className={tier.badgeClass}>{tier.label}</span>
        <strong>{actionSummary(tier)}</strong>
        <span>{sourceText}</span>
      </div>
      {!compact && (
        <div className="job-trust-actions" aria-label="岗位可用动作">
          <span className={tier.canUseAsLearningTarget ? 'enabled' : ''}>
            <IconTarget size={13} />学习目标
          </span>
          <span className={tier.canDirectApply ? 'enabled' : ''}>
            <IconDocument size={13} />简历
          </span>
          <span className={tier.canDirectApply ? 'enabled' : ''}>
            <IconSend size={13} />投递
          </span>
          <span className={tier.canDirectApply ? 'enabled' : ''}>
            <IconBriefcase size={13} />平台岗位
          </span>
          {!tier.canDirectApply && (
            <span className="enabled">
              <IconBook size={13} />补齐计划
            </span>
          )}
        </div>
      )}
    </div>
  );
}
