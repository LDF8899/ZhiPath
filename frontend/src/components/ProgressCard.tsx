import '../styles/hand-draw.css';
import { IconCheck, IconClock, IconLightbulb } from './icons';

interface Props {
  data: {
    total_skills: number;
    done_skills: number;
    currentPhase: number;
    matchScore: number;
    estimatedDate: string;
    phases: Array<{
      name: string;
      total: number;
      done: number;
      status: 'done' | 'current' | 'locked';
    }>;
    message?: string;
    paths?: any[];
  };
}

export default function ProgressCard({ data }: Props) {
  if (!data.phases?.length) {
    return (
      <div className="hd-card" style={{ fontSize: 14, color: 'var(--pencil)' }}>
        {data.message || '暂无学习路径数据'}
      </div>
    );
  }

  const percent = Math.round((data.done_skills / data.total_skills) * 100);

  return (
    <div className="hd-card">
      <div className="hd-flex" style={{ gap: 16, marginBottom: 16 }}>
        {/* Circular progress indicator */}
        <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="var(--rule)"
              strokeWidth="4"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="var(--data-blue)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - percent / 100)}`}
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset 0.4s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '800 16px/1 var(--serif)',
            color: 'var(--ink)',
          }}>
            {percent}%
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>
            已掌握 {data.done_skills}/{data.total_skills} 项技能
          </div>
          <div style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 2 }}>
            匹配度 {data.matchScore}% · 预计 {data.estimatedDate} 达成
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.phases.map((phase, i) => (
          <div key={i} className="hd-flex" style={{ gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', color: phase.status === 'done' ? '#4a9d4a' : phase.status === 'current' ? 'var(--accent)' : 'var(--pencil)' }}>
              {phase.status === 'done' ? (
                <IconCheck size={18} />
              ) : phase.status === 'current' ? (
                <IconClock size={18} />
              ) : (
                <IconLightbulb size={18} />
              )}
            </span>
            <span style={{
              flex: 1,
              fontSize: 14,
              color: phase.status === 'locked' ? 'var(--pencil)' : 'var(--ink)',
            }}>
              {phase.name}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--pencil)' }}>
              {phase.done}/{phase.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
