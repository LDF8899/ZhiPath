import '../styles/hand-draw.css';

interface SkillGapData {
  jobTitle?: string;
  totalRequired?: number;
  matched?: number;
  gap?: number;
  matchedSkills?: Array<string | { name?: string }>;
  gapSkills?: Array<string | { name?: string }>;
  matchScore?: number;
  message?: string;
}

function skillName(s: string | { name?: string }): string {
  return typeof s === 'string' ? s : (s.name || '');
}

export default function SkillGapCard({ data }: { data: SkillGapData }) {
  if (data.message) {
    return (
      <div className="hd-card" style={{ fontSize: 14, color: 'var(--pencil)' }}>
        {data.message}
      </div>
    );
  }

  const score = data.matchScore ?? 0;
  const matchedList = (data.matchedSkills || []).map(skillName);
  const gapList = (data.gapSkills || []).map(skillName);

  return (
    <div className="hd-card">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        🎯 {data.jobTitle || '目标岗位'} 匹配度分析
      </div>

      {/* 匹配度条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary, #eee)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: `${score}%`,
              height: '100%',
              borderRadius: 4,
              background: score >= 70 ? '#2ed573' : score >= 40 ? '#ffa502' : '#ff4757',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <span style={{ fontWeight: 700, fontSize: 18, color: score >= 70 ? '#2ed573' : score >= 40 ? '#ffa502' : '#ff4757' }}>
          {score}%
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 8 }}>
        <span>✅ 已掌握 <b>{data.matched ?? 0}</b></span>
        <span>📈 待学习 <b>{data.gap ?? 0}</b></span>
        <span>📋 共需 <b>{data.totalRequired ?? 0}</b> 项技能</span>
      </div>

      {gapList.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--pencil)', marginBottom: 4 }}>需要学习的技能：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {gapList.map((s, i) => (
              <span key={i} className="hd-tag" style={{ background: '#fff3e0', color: '#e65100', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {matchedList.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--pencil)', marginBottom: 4 }}>已掌握的技能：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {matchedList.map((s, i) => (
              <span key={i} className="hd-tag" style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                ✅ {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
