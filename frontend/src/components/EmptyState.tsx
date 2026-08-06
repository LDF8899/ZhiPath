import {
  IconArrowRight,
  IconBook,
  IconBriefcase,
  IconGradCap,
  IconRefresh,
  IconTarget,
} from './icons';

type EmptyStateTone = 'default' | 'action' | 'warning' | 'success';
type EmptyStateIcon = 'target' | 'briefcase' | 'book' | 'test' | 'refresh';

const ICONS = {
  target: IconTarget,
  briefcase: IconBriefcase,
  book: IconBook,
  test: IconGradCap,
  refresh: IconRefresh,
};

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'target',
  tone = 'default',
  compact = false,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: EmptyStateIcon;
  tone?: EmptyStateTone;
  compact?: boolean;
}) {
  const Icon = ICONS[icon];
  return (
    <div className={`hd-empty-state ${tone} ${compact ? 'compact' : ''}`}>
      <div className="hd-empty-state-icon">
        <Icon size={compact ? 18 : 24} />
      </div>
      <div className="hd-empty-state-body">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {actionLabel && onAction && (
        <button className="hd-btn small secondary" onClick={onAction}>
          {actionLabel}
          <IconArrowRight size={12} style={{ marginLeft: 5 }} />
        </button>
      )}
    </div>
  );
}
