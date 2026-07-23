type AvatarConceptId = 'staff' | 'terminal' | 'pilot' | 'badge';
type WorkStatus = 'idle' | 'working' | 'completed';

interface Concept {
  id: AvatarConceptId;
  name: string;
  role: string;
  color: string;
  accent: string;
  note: string;
}

const CONCEPTS: Concept[] = [
  {
    id: 'staff',
    name: '职业半身',
    role: '路径规划师',
    color: '#2f6f73',
    accent: '#f4c95d',
    note: '更像办公室同事，适合作为主方案',
  },
  {
    id: 'terminal',
    name: '终端员工',
    role: '代码大师',
    color: '#4256a6',
    accent: '#63d297',
    note: '技术感更强，适合代码/图表类智能体',
  },
  {
    id: 'pilot',
    name: '任务驾驶员',
    role: '岗位顾问',
    color: '#b95b42',
    accent: '#83c5be',
    note: '行动感更强，适合忙碌状态',
  },
  {
    id: 'badge',
    name: '部门徽章',
    role: '评估专家',
    color: '#6f5c8f',
    accent: '#f2a65a',
    note: '更克制，适合右侧列表和小尺寸',
  },
];

const STATUS_LABELS: Record<WorkStatus, string> = {
  idle: '待命',
  working: '工作中',
  completed: '完成',
};

function EyePair({ variant }: { variant: 'calm' | 'focus' | 'smile' }) {
  if (variant === 'focus') {
    return (
      <g>
        <path d="M35 42h10" stroke="#1d1b18" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 42h10" stroke="#1d1b18" strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="47" r="3.2" fill="#1d1b18" />
        <circle cx="60" cy="47" r="3.2" fill="#1d1b18" />
      </g>
    );
  }
  if (variant === 'smile') {
    return (
      <g>
        <path d="M35 45q5 5 10 0" fill="none" stroke="#1d1b18" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 45q5 5 10 0" fill="none" stroke="#1d1b18" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="40" cy="45" r="4.2" fill="#1d1b18" />
      <circle cx="60" cy="45" r="4.2" fill="#1d1b18" />
      <circle cx="41.5" cy="43.5" r="1.5" fill="#fff" />
      <circle cx="61.5" cy="43.5" r="1.5" fill="#fff" />
    </g>
  );
}

function WorkGlyph({ concept, accent }: { concept: AvatarConceptId; accent: string }) {
  if (concept === 'terminal') {
    return (
      <g>
        <rect x="63" y="59" width="25" height="18" rx="3" fill="#1d1b18" stroke="#1d1b18" strokeWidth="2" />
        <path d="M69 66l4 3-4 3M76 72h6" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (concept === 'pilot') {
    return (
      <g>
        <rect x="64" y="58" width="21" height="25" rx="4" fill="#fff7df" stroke="#1d1b18" strokeWidth="2" />
        <path d="M69 65h10M69 71h7M69 77h11" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        <circle cx="82" cy="57" r="6" fill={accent} stroke="#1d1b18" strokeWidth="2" />
      </g>
    );
  }
  if (concept === 'badge') {
    return (
      <g>
        <path d="M70 60h16v17l-8 6-8-6z" fill={accent} stroke="#1d1b18" strokeWidth="2" strokeLinejoin="round" />
        <path d="M74 70l3 3 6-7" fill="none" stroke="#1d1b18" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  return (
    <g>
      <rect x="64" y="60" width="21" height="18" rx="4" fill="#fff7df" stroke="#1d1b18" strokeWidth="2" />
      <path d="M69 67h11M69 72h8" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d="M74 60v-5" stroke="#1d1b18" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function AgentConceptAvatar({ concept, status = 'idle' }: { concept: Concept; status?: WorkStatus }) {
  const skin = '#f3c7a6';
  const shirt = concept.color;
  const accent = concept.accent;
  const eyeVariant = status === 'working'
    ? 'focus'
    : status === 'completed'
      ? 'smile'
      : concept.id === 'pilot' ? 'smile' : 'calm';

  return (
    <svg className={`avatar-concept-svg avatar-${status}`} viewBox="0 0 100 100" role="img" aria-label={`${concept.name}${STATUS_LABELS[status]}`}>
      <defs>
        <linearGradient id={`${concept.id}-jacket`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shirt} />
          <stop offset="1" stopColor="#20242f" />
        </linearGradient>
        <radialGradient id={`${concept.id}-face`} cx="45%" cy="35%" r="60%">
          <stop offset="0" stopColor="#ffe0c4" />
          <stop offset="1" stopColor={skin} />
        </radialGradient>
      </defs>

      {status === 'working' && (
        <g className="avatar-work-ring">
          <circle cx="50" cy="50" r="42" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="9 7" opacity=".75" />
          <path d="M76 20l6 6-6 6" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <ellipse cx="50" cy="89" rx="31" ry="6" fill="#1d1b18" opacity=".12" />
      <path d="M25 78q4-21 25-21t25 21v9H25z" fill={`url(#${concept.id}-jacket)`} stroke="#1d1b18" strokeWidth="2.5" />
      <path d="M40 61l10 14 10-14" fill="#fbf6ea" stroke="#1d1b18" strokeWidth="2" strokeLinejoin="round" />
      <path d="M47 63h6l2 13-5 5-5-5z" fill={accent} stroke="#1d1b18" strokeWidth="1.7" strokeLinejoin="round" />

      <circle cx="50" cy="42" r="22" fill={`url(#${concept.id}-face)`} stroke="#1d1b18" strokeWidth="2.8" />
      <path d="M29 38q5-20 22-20t21 20q-9-7-22-7t-21 7z" fill="#28231f" stroke="#1d1b18" strokeWidth="2.2" />
      <path d="M31 37q14-17 38-2" fill="none" stroke="#4b433a" strokeWidth="3" strokeLinecap="round" opacity=".35" />
      <EyePair variant={eyeVariant} />
      <path d="M46 54q4 4 8 0" fill="none" stroke="#1d1b18" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33" cy="51" r="4" fill="#ef8d8d" opacity=".38" />
      <circle cx="67" cy="51" r="4" fill="#ef8d8d" opacity=".38" />

      {concept.id === 'terminal' && (
        <g>
          <path d="M25 44h-5q-4 0-4 4v8q0 4 4 4h5" fill="none" stroke="#1d1b18" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M75 44h5q4 0 4 4v8q0 4-4 4h-5" fill="none" stroke="#1d1b18" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M20 48v8M80 48v8" stroke={accent} strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {concept.id === 'pilot' && (
        <g>
          <path d="M30 34q20-12 40 0" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
          <path d="M38 30h24" stroke="#1d1b18" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      <WorkGlyph concept={concept.id} accent={accent} />
      {status === 'working' && (
        <g className="avatar-work-lines">
          <path d="M14 28h8M11 39h7M78 15h8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 64h7M80 45h7M75 86h8" stroke="#1d1b18" strokeWidth="2" strokeLinecap="round" opacity=".35" />
        </g>
      )}
      {status === 'completed' && (
        <g>
          <circle cx="82" cy="22" r="11" fill="#63d297" stroke="#1d1b18" strokeWidth="2.4" />
          <path d="M76 22l4 4 8-9" fill="none" stroke="#1d1b18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <rect x="34" y="80" width="31" height="10" rx="4" fill="#fbf6ea" stroke="#1d1b18" strokeWidth="2" />
      <circle cx="40" cy="85" r="2.5" fill={accent} />
      <path d="M46 85h13" stroke="#1d1b18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AgentAvatarConcepts() {
  return (
    <section className="avatar-concepts-panel" aria-label="员工形象预览">
      <div className="avatar-concepts-head">
        <div>
          <strong>员工形象方向预览</strong>
          <span>待命、工作中、完成三种状态</span>
        </div>
      </div>
      <div className="avatar-concepts-grid">
        {CONCEPTS.map((concept) => (
          <article key={concept.id} className="avatar-concept-card">
            <div className="avatar-status-strip">
              {(['idle', 'working', 'completed'] as WorkStatus[]).map((status) => (
                <div key={status} className={`avatar-status-sample status-${status}`}>
                  <div className="avatar-concept-stage">
                    <AgentConceptAvatar concept={concept} status={status} />
                    <span className="avatar-status-dot" />
                  </div>
                  <span className="avatar-status-label">{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
            <div className="avatar-concept-info">
              <strong>{concept.name}</strong>
              <span>{concept.role}</span>
              <p>{concept.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
