import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Library,
  Loader2,
  PenLine,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react';
import { EVENT_TYPES, useStreamEvents } from '../lib/sse';

/**
 * 多 Agent 闭环的可视化 —— 这是"不黑盒"的核心。
 *
 * 用户必须能看见：谁在做事、做到哪一步、产出了什么、可信度多少。
 * 数据有三个来源，按优先级合并：
 *   1. SSE 实时事件（agent_progress / agent_status / resource_ready）
 *   2. 智能体办公室任务台账（agent-office/tasks）
 *   3. 页面传入的静态阶段描述（首次进入时的说明性骨架）
 */

export type AgentRole = 'diagnose' | 'expert' | 'maker' | 'reviewer' | 'planner';

export const AGENT_META: Record<AgentRole, { name: string; verb: string; role: string; icon: ReactNode }> = {
  diagnose: {
    name: '学情诊断 Agent',
    verb: '识别',
    role: '整合背景、测评与实践记录，定位当前最该补的能力缺口',
    icon: <BrainCircuit size={15} />,
  },
  expert: {
    name: '领域专家 Agent',
    verb: '检索',
    role: '从垂直领域知识库召回可信片段，限定生成边界',
    icon: <Library size={15} />,
  },
  maker: {
    name: '资源生成 Agent',
    verb: '生成',
    role: '把知识转成定制讲义、实操指南和分阶测试题',
    icon: <PenLine size={15} />,
  },
  reviewer: {
    name: '审核纠偏 Agent',
    verb: '校验',
    role: '检查事实、引用覆盖、难度与格式，拦住低可信内容',
    icon: <ShieldCheck size={15} />,
  },
  planner: {
    name: '路径决策 Agent',
    verb: '调整',
    role: '根据正确率与反馈决定降维解释、补弱巩固还是进阶挑战',
    icon: <RouteIcon size={15} />,
  },
};

export const AGENT_ROLES: AgentRole[] = ['diagnose', 'expert', 'maker', 'reviewer', 'planner'];

export type TraceStep = {
  id: string;
  role: AgentRole;
  /** 一句话说清这一步做了什么、依据是什么 */
  output: string;
  status: 'done' | 'working' | 'pending';
  confidence?: number;
  meta?: string;
};

/** 把后端 office 的 agentType 映射到产品叙事里的角色 */
export function mapOfficeAgentType(agentType: string): AgentRole {
  const key = String(agentType || '').toLowerCase();
  if (['profile', 'diagnose', 'diagnosis', 'assess'].includes(key)) return 'diagnose';
  if (['expert', 'domain', 'knowledge', 'reading'].includes(key)) return 'expert';
  if (['lecture', 'code', 'generator', 'maker', 'video', 'exam'].includes(key)) return 'maker';
  if (['reviewer', 'review', 'audit'].includes(key)) return 'reviewer';
  if (['path', 'planner', 'plan', 'daily_task'].includes(key)) return 'planner';
  return 'maker';
}

export function AgentTrace({ steps, compact = false }: { steps: TraceStep[]; compact?: boolean }) {
  return (
    <div className="trace">
      {steps.map((step, index) => {
        const meta = AGENT_META[step.role];
        const isLast = index === steps.length - 1;
        return (
          <article
            key={step.id}
            className={`trace__item agent-tone--${step.role} ${step.status === 'done' ? 'is-done' : ''} ${
              step.status === 'working' ? 'is-working' : ''
            }`}
          >
            <div className="trace__rail">
              <span className="trace__node">
                {step.status === 'done' ? (
                  <CheckCircle2 size={15} strokeWidth={2.4} />
                ) : step.status === 'working' ? (
                  <Loader2 size={14} className="btn__spinner" style={{ borderWidth: 2 }} />
                ) : (
                  meta.icon
                )}
              </span>
              {!isLast && <span className="trace__line" />}
            </div>

            <div className="trace__content">
              <header className="trace__head">
                <span className="trace__name">{meta.name}</span>
                <span className="trace__verb">{meta.verb}</span>
                {step.status === 'working' && (
                  <span className="tag tag--amber tag--dot">进行中</span>
                )}
                {step.status === 'pending' && <span className="tag tag--outline">待触发</span>}
                {step.confidence !== undefined && step.status === 'done' && (
                  <span className="tag tag--green">
                    <BadgeCheck size={11} />
                    可信度 {Math.round(step.confidence)}%
                  </span>
                )}
              </header>

              {!compact && <p className="trace__output">{step.output}</p>}
              {compact && <p className="trace__output clamp-2">{step.output}</p>}

              {step.meta && <div className="trace__meta">{step.meta}</div>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * 实时 Agent 指示灯 —— 挂在工作台顶部，
 * 有 Agent 在跑就亮起来，把"后台在忙"这件事变成可见的状态。
 */
export function AgentActivityPill({
  label = 'Agent 空闲',
  busyLabel = 'Agent 正在为你生成内容',
}: {
  label?: string;
  busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useStreamEvents(
    [EVENT_TYPES.AGENT_PROGRESS, EVENT_TYPES.AGENT_STATUS, EVENT_TYPES.RESOURCE_READY, EVENT_TYPES.TASK_PROGRESS],
    (event) => {
      setBusy(true);
      if (event.type === EVENT_TYPES.RESOURCE_READY) {
        setDetail(`${event.data?.skill_name || ''} 资源已就绪`);
      } else if (event.type === EVENT_TYPES.TASK_PROGRESS) {
        setDetail(event.data?.message || '任务处理中');
      } else if (event.type === EVENT_TYPES.AGENT_STATUS && event.data?.status === 'idle') {
        setBusy(false);
        return;
      } else {
        setDetail(event.data?.message || '');
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setBusy(false);
        setDetail('');
      }, 25_000);
    },
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!busy) {
    return (
      <span className="tag tag--outline">
        <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--text-faint)' }} />
        {label}
      </span>
    );
  }

  return (
    <span className="tag tag--brand">
      <Loader2 size={11} className="btn__spinner" style={{ borderWidth: 2 }} />
      {detail || busyLabel}
    </span>
  );
}

/** 可信生成指示：知识库引用 / 交叉验证 / 幻觉风险（只展示后端真实回传的度量） */
export function TrustBadges({
  citationCoverage,
  crossValidated,
  hallucinationRisk,
  citationMiss,
  evidenceCount,
}: {
  citationCoverage?: number;
  crossValidated?: number;
  hallucinationRisk?: number;
  citationMiss?: boolean;
  /** 本条回复实际引用的知识库证据条数（真实数据，非估算） */
  evidenceCount?: number;
}) {
  const items: Array<{ label: string; tone: 'green' | 'amber' | 'rose'; text: string; icon: ReactNode }> = [];

  if (evidenceCount !== undefined && evidenceCount > 0) {
    items.push({
      label: '知识库引用',
      tone: 'green',
      text: `${evidenceCount} 条`,
      icon: <Library size={11} />,
    });
  }
  if (citationCoverage !== undefined) {
    items.push({
      label: '引用覆盖',
      tone: citationCoverage >= 80 ? 'green' : citationCoverage >= 60 ? 'amber' : 'rose',
      text: `${Math.round(citationCoverage)}%`,
      icon: <FileSearch size={11} />,
    });
  }
  if (crossValidated !== undefined) {
    items.push({
      label: '交叉验证',
      tone: crossValidated >= 2 ? 'green' : 'amber',
      text: `${crossValidated} 源`,
      icon: <BadgeCheck size={11} />,
    });
  }
  if (hallucinationRisk !== undefined) {
    items.push({
      label: '幻觉风险',
      tone: hallucinationRisk <= 3.5 ? 'green' : hallucinationRisk <= 7 ? 'amber' : 'rose',
      text: `${hallucinationRisk}%`,
      icon: <ShieldCheck size={11} />,
    });
  }
  if (citationMiss) {
    items.push({ label: '未命中引用', tone: 'rose', text: '已标记', icon: <ShieldCheck size={11} /> });
  }

  if (items.length === 0) return null;

  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {items.map((item) => (
        <span key={item.label} className={`tag tag--${item.tone}`}>
          {item.icon}
          {item.label} {item.text}
        </span>
      ))}
    </div>
  );
}
