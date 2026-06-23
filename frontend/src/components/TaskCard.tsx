import '../styles/hand-draw.css';
import { IconCheck, IconClock } from './icons';

interface Props {
  data: {
    phase_name: string;
    tasks: Array<{
      title: string;
      phase: string;
      duration: string;
      status: string;
    }>;
    total: number;
  };
}

export default function TaskCard({ data }: Props) {
  const pending = data.tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="hd-card">
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>今日任务</span>
        <span className="hd-badge">{data.phase_name} · 剩余 {pending} 项</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.tasks.map((task, i) => (
          <div
            key={i}
            className="hd-flex"
            style={{
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              background: task.status === 'done' ? 'var(--paper-tint)' : 'var(--note-yellow)',
              opacity: task.status === 'done' ? 0.7 : 1,
            }}
          >
            {task.status === 'done' ? (
              <IconCheck size={16} className="hd-badge green" />
            ) : (
              <IconClock size={16} style={{ color: 'var(--accent)' }} />
            )}
            <span style={{
              flex: 1,
              fontSize: 14,
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              color: task.status === 'done' ? 'var(--pencil)' : 'var(--ink)',
            }}>
              {task.title}
            </span>
            <span style={{ fontSize: 11, color: 'var(--pencil)', fontFamily: 'var(--mono)' }}>{task.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
