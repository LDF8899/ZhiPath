import '../styles/hand-draw.css';

interface MatchBreakdownProps {
  breakdown: {
    requiredSkills: { score: number };
    preferredSkills: { score: number };
    projects: { score: number };
    exams: { score: number };
    learningProgress: { score: number };
    learningSpeed?: { score: number };
  };
  /** 后端返回的分场景权重（§7.1），缺省回退到校招权重 */
  weights?: {
    requiredSkills: number;
    preferredSkills: number;
    projects: number;
    exams: number;
    learningProgress: number;
    learningSpeed: number;
  };
  scenario?: 'campus' | 'social';
  compact?: boolean;
}

const FACTOR_META = [
  { key: 'requiredSkills', label: '必须技能', color: 'var(--data-blue)' },
  { key: 'preferredSkills', label: '加分技能', color: '#8b5cf6' },
  { key: 'projects', label: '项目经历', color: '#4a9d4a' },
  { key: 'exams', label: '考试成绩', color: '#e6a817' },
  { key: 'learningProgress', label: '学习进度', color: 'var(--accent)' },
  { key: 'learningSpeed', label: '学习速度', color: '#e07a5f' },
];

// §7.1 校招默认权重（无 weights 时回退）
const DEFAULT_WEIGHTS = {
  requiredSkills: 0.30, preferredSkills: 0.15, projects: 0.15,
  exams: 0.20, learningProgress: 0.10, learningSpeed: 0.10,
};

export default function MatchBreakdown({ breakdown, weights, scenario, compact = false }: MatchBreakdownProps) {
  if (!breakdown) return null;

  const w = weights || DEFAULT_WEIGHTS;
  // 权重为 0 的因子不展示（如社招的学习速度）
  const FACTORS = FACTOR_META
    .filter((f) => (w[f.key as keyof typeof w] ?? 0) > 0)
    .map((f) => ({ ...f, weight: `${Math.round((w[f.key as keyof typeof w] as number) * 100)}%` }));

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenario && (
          <div style={{ fontSize: 11, color: 'var(--pencil)', marginBottom: 2 }}>
            {scenario === 'social' ? '社招权重' : '校招权重'}
          </div>
        )}
        {FACTORS.map((factor) => {
          const data = breakdown[factor.key as keyof typeof breakdown] as { score: number };
          const score = data?.score || 0;

          return (
            <div key={factor.key} className="hd-flex" style={{ gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--pencil)', width: 64, flexShrink: 0 }}>{factor.label}</span>
              <div className="hd-progress" style={{ flex: 1 }}>
                <div className="hd-progress-bar" style={{ width: `${score}%`, background: factor.color }} />
              </div>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', width: 32, textAlign: 'right' }}>{score}%</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {scenario && (
        <div className="hd-badge" style={{ alignSelf: 'flex-start' }}>
          {scenario === 'social' ? '社招场景' : '校招场景'}
        </div>
      )}
      {FACTORS.map((factor) => {
        const data = breakdown[factor.key as keyof typeof breakdown] as { score: number };
        const score = data?.score || 0;

        return (
          <div key={factor.key} className="hd-kpi">
            <div className="hd-flex-between" style={{ marginBottom: 6 }}>
              <div className="hd-flex" style={{ gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: factor.color, border: '1.5px solid var(--ink)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 14 }}>{factor.label}</span>
                <span className="hd-badge">权重 {factor.weight}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--serif)', color: factor.color }}>{score}%</span>
            </div>
            <div className="hd-progress">
              <div className="hd-progress-bar" style={{ width: `${score}%`, background: factor.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
