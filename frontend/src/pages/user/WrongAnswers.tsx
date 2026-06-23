import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWrongAnswers } from '../../api/user';
import '../../styles/hand-draw.css';
import {
  IconArrowLeft,
  IconBook,
  IconRefresh,
  IconX,
  IconLightbulb,
  IconTarget,
} from '../../components/icons';

interface WrongItem {
  examId: number;
  skillName: string;
  examType: number;
  createTime: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  type: string;
}

interface SkillGroup {
  skill: string;
  count: number;
  items: WrongItem[];
}

export default function WrongAnswers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<SkillGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [filterSkill, setFilterSkill] = useState<string>('');

  useEffect(() => {
    loadWrongAnswers();
  }, [filterSkill]);

  const loadWrongAnswers = async () => {
    setLoading(true);
    try {
      const res = await getWrongAnswers(filterSkill || undefined);
      if (res.code === 200 && res.data) {
        setSkills(res.data.skills || []);
        setTotal(res.data.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const examTypeLabel = (t: number) => {
    if (t === 2) return '岗位考试';
    if (t === 3) return '速测';
    return '技能考试';
  };

  return (
    <div className="hd-page">
      <div className="hd-page-wrap" style={{ maxWidth: 800 }}>
        {/* Header */}
        <div className="hd-header" style={{ marginBottom: 20 }}>
          <div className="hd-flex">
            <button className="hd-btn secondary small" onClick={() => navigate(-1)}>
              <IconArrowLeft size={16} />
            </button>
            <h2>错题本</h2>
            <span className="hd-badge" style={{ marginLeft: 10 }}>{total} 道错题</span>
          </div>
          <button className="hd-btn secondary small" onClick={loadWrongAnswers}>
            <IconRefresh size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            刷新
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="hd-loading">
            <svg width="36" height="36" viewBox="0 0 48 48" style={{ marginBottom: 12 }}>
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="3" strokeDasharray="6 4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="30 96" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
              </circle>
            </svg>
            <div>加载中...</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && skills.length === 0 && (
          <div className="hd-empty">
            <IconTarget size={40} style={{ margin: '0 auto 12px', color: 'var(--pencil)' }} />
            <p style={{ fontWeight: 700 }}>暂无错题</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>参加考试后，错题会自动收录到这里</p>
            <button className="hd-btn small" style={{ marginTop: 16 }} onClick={() => navigate('/user/exams')}>
              去参加考试
            </button>
          </div>
        )}

        {/* Wrong answers grouped by skill */}
        {!loading && skills.map((group) => (
          <div key={group.skill} className="hd-card-accent" style={{ marginBottom: 16 }}>
            {/* Skill header */}
            <div
              className="hd-flex-between"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpandedSkill(expandedSkill === group.skill ? null : group.skill)}
            >
              <div className="hd-flex" style={{ gap: 10 }}>
                <IconBook size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 17, color: 'var(--ink)' }}>
                  {group.skill}
                </span>
                <span className="hd-badge red">{group.count} 题</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--pencil)' }}>
                {expandedSkill === group.skill ? '收起 ▲' : '展开 ▼'}
              </span>
            </div>

            {/* Expanded items */}
            {expandedSkill === group.skill && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.items.map((item, i) => (
                  <div key={i} className="hd-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <IconX size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>
                        {item.question || '未知题目'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span className="hd-tag">{examTypeLabel(item.examType)}</span>
                        <span className="hd-tag">{formatDate(item.createTime)}</span>
                      </div>
                      {item.userAnswer && (
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--pencil)' }}>
                          <span style={{ color: 'var(--accent)' }}>你的答案：</span>{item.userAnswer}
                          {item.correctAnswer && (
                            <span style={{ marginLeft: 12, color: '#3a7d3a' }}>正确答案：{item.correctAnswer}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {group.skill && group.skill !== '未知' && group.skill !== '未知技能' && (
                      <button
                        className="hd-btn secondary small"
                        onClick={() => navigate(`/user/knowledge/${encodeURIComponent(group.skill)}`)}
                      >
                        去学习
                      </button>
                    )}
                  </div>
                ))}

                {/* Go to study button */}
                {group.skill && group.skill !== '未知' && group.skill !== '未知技能' && (
                  <button
                    className="hd-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => navigate(`/user/knowledge/${encodeURIComponent(group.skill)}`)}
                  >
                    <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                    重新学习「{group.skill}」
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
