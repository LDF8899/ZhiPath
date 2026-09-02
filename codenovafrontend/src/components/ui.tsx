import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { useToastStore, type ToastTone } from '../store/toast';
import { makeStardust, useCountUp, useMagnetic, useReveal } from '../lib/motion';

// ── 按钮 ────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  /** 磁吸：指针靠近时按钮轻微吸附（主要 CTA 用） */
  magnetic?: boolean;
};

export function Button({
  variant = 'ghost',
  size = 'md',
  block,
  loading,
  icon,
  magnetic,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const magRef = useMagnetic<HTMLButtonElement>(0.18);
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={magnetic ? magRef : undefined}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn__spinner" /> : icon}
      {children}
    </button>
  );
}

// ── 卡片 ────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  style,
  pad,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  pad?: boolean;
  interactive?: boolean;
}) {
  return (
    <section
      className={`card ${pad ? 'card--pad' : ''} ${interactive ? 'card--interactive' : ''} ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export function CardHead({
  icon,
  title,
  extra,
}: {
  icon?: ReactNode;
  title: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <header className="card__head">
      <div className="card__title">
        {icon && <span className="icon-wrap">{icon}</span>}
        <h2>{title}</h2>
      </div>
      {extra}
    </header>
  );
}

export function CardBody({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card__body ${className}`} style={style}>
      {children}
    </div>
  );
}

// ── 标签 ────────────────────────────────────────────────

type TagTone = 'neutral' | 'brand' | 'teal' | 'amber' | 'rose' | 'green' | 'violet' | 'outline';

export function Tag({
  tone = 'neutral',
  dot,
  icon,
  children,
}: {
  tone?: TagTone;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`tag tag--${tone} ${dot ? 'tag--dot' : ''}`}>
      {icon}
      {children}
    </span>
  );
}

// ── 表单 ────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span style={{ color: 'var(--rose-600)' }}>*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}

export function Range({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <input
      className="range"
      type="range"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Choice({
  title,
  desc,
  selected,
  disabled,
  icon,
  onClick,
}: {
  title: ReactNode;
  desc?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="choice"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {selected && (
        <span className="choice__check">
          <CheckCircle2 size={12} strokeWidth={3} />
        </span>
      )}
      <span className="choice__title">{title}</span>
      {desc && <span className="choice__desc">{desc}</span>}
      {icon}
    </button>
  );
}

// ── 进度 ────────────────────────────────────────────────

export function Bar({
  value,
  tone,
  flowing,
}: {
  value: number;
  tone?: 'green' | 'amber' | 'rose';
  flowing?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`bar__fill ${tone ? `bar__fill--${tone}` : ''} ${flowing ? 'bar__fill--flowing' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** 掌握度权重分段条：讲义 30 / 测验 25 / 实践 25 / 测评 20 */
export function WeightBar({ segments }: { segments: Array<{ label: string; weight: number; done: boolean }> }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="weight-bar">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`weight-bar__seg ${segment.done ? 'is-done' : ''}`}
            style={{ flexGrow: segment.weight }}
            title={`${segment.label} ${segment.done ? '已完成' : '未完成'} · 权重 ${segment.weight}%`}
          />
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        {segments.map((segment) => (
          <span
            key={segment.label}
            className="tiny"
            style={{
              color: segment.done ? 'var(--green-600)' : 'var(--text-faint)',
              fontWeight: segment.done ? 600 : 450,
            }}
          >
            {segment.done ? '✓ ' : ''}
            {segment.label} +{segment.weight}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 反馈态 ──────────────────────────────────────────────

export function Skeleton({ height = 14, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />;
}

export function Empty({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <div className="empty__title">{title}</div>
      {desc && <p className="empty__desc">{desc}</p>}
      {action}
    </div>
  );
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  const icons = {
    info: <Info size={15} />,
    success: <CheckCircle2 size={15} />,
    warning: <AlertTriangle size={15} />,
    error: <AlertCircle size={15} />,
  };
  return (
    <div className={`banner banner--${tone}`}>
      {icons[tone]}
      <div>{children}</div>
    </div>
  );
}

/** 全屏 loading：用文字说明在做什么，避免"黑盒转圈" */
export function LoadingBlock({ text = '正在加载', sub }: { text?: string; sub?: string }) {
  return (
    <div className="empty">
      <Loader2 size={26} className="btn__spinner" style={{ color: 'var(--brand-600)', borderWidth: 2.5 }} />
      <div className="empty__title">{text}</div>
      {sub && <p className="empty__desc">{sub}</p>}
    </div>
  );
}

// ── 弹层 ────────────────────────────────────────────────

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true">
        <header className="modal__head">
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Toast ───────────────────────────────────────────────

const TOAST_ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={17} />,
  error: <AlertCircle size={17} />,
  info: <Info size={17} />,
  warn: <AlertTriangle size={17} />,
};

export function Toaster() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  if (items.length === 0) return null;

  return createPortal(
    <div className="toast-stack">
      {items.slice(-4).map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`} role="status">
          <span className="toast__icon">{TOAST_ICONS[item.tone]}</span>
          <div className="toast__body grow">
            <div className="toast__title">{item.title}</div>
            {item.desc && <div className="toast__desc">{item.desc}</div>}
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => dismiss(item.id)} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── 指标 ────────────────────────────────────────────────

export function Metric({
  label,
  value,
  unit,
  foot,
  accent,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={`metric ${accent ? 'metric--accent' : ''}`}>
      <div className="metric__label">
        {icon}
        {label}
      </div>
      <div className="metric__value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="metric__foot">{foot}</div>}
    </div>
  );
}

// ── 步骤条 ──────────────────────────────────────────────

export function Steps({ items, current }: { items: string[]; current: number }) {
  return (
    <div className="steps">
      {items.map((label, index) => {
        const state = index < current ? 'is-done' : index === current ? 'is-active' : '';
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div className={`steps__item ${state}`}>
              <span className="steps__dot">
                {index < current ? <CheckCircle2 size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span className="steps__label">{label}</span>
            </div>
            {index < items.length - 1 && (
              <span className={`steps__line ${index < current ? 'is-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── NOVA 组件：StatCard（数字滚动） ─────────────────────

export function StatCard({
  label,
  value,
  unit,
  foot,
  icon,
  gradient,
}: {
  label: ReactNode;
  value: number;
  unit?: string;
  foot?: ReactNode;
  icon?: ReactNode;
  gradient?: string;
}) {
  const display = useCountUp(value);
  return (
    <div className="stat-card" style={gradient ? ({ '--stat-grad': gradient } as React.CSSProperties) : undefined}>
      {icon && <span className="stat-card__icon">{icon}</span>}
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">
        {display}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="stat-card__foot">{foot}</div>}
    </div>
  );
}

// ── NOVA 组件：ProgressRing（渐变进度环） ────────────────

export function ProgressRing({
  value,
  size = 84,
  stroke = 7,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const len = 2 * Math.PI * radius;
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="nova-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="48%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle className="progress-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="progress-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={len}
          strokeDashoffset={len * (1 - pct / 100)}
        />
      </svg>
      <div className="progress-ring__center">
        <div>
          <div className="progress-ring__value">{Math.round(pct)}</div>
          {label && <div className="tiny faint">{label}</div>}
        </div>
      </div>
    </div>
  );
}

// ── NOVA 组件：GradientText（渐变文字） ──────────────────

export function GradientText({ children, flow }: { children: ReactNode; flow?: boolean }) {
  return <span className={`text-gradient ${flow ? 'text-gradient--flow' : ''}`}>{children}</span>;
}

// ── NOVA 组件：Stardust（星尘环境粒子） ──────────────────

export function Stardust({ count = 14, seed = 7 }: { count?: number; seed?: number }) {
  const dots = useMemo(() => makeStardust(count, seed), [count, seed]);
  return (
    <div className="stardust" aria-hidden>
      {dots.map((style, index) => (
        <span key={index} className="stardust__dot" style={style} />
      ))}
    </div>
  );
}

// ── NOVA 组件：Reveal（视口入场揭示） ────────────────────

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

// ── NOVA 组件：SectionTitle（渐变发丝线标题） ─────────────

export function SectionTitle({ icon, title, extra }: { icon?: ReactNode; title: ReactNode; extra?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>
        {icon}
        {title}
      </h2>
      {extra}
    </div>
  );
}

// ── 数据加载 hook ───────────────────────────────────────
export function useAsync<T>(
  factory: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  initial: T | null = null,
) {
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    factory()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((err: any) => {
        if (alive) setError(err?.message || '加载失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload: () => setTick((value) => value + 1), setData };
}
