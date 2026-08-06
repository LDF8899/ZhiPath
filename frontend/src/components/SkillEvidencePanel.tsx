import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSkillEvidence } from '../api/user';
import type { SkillEvidence } from '../types';
import {
  IconBook,
  IconGradCap,
  IconBriefcase,
  IconDocument,
  IconArrowRight,
  IconRefresh,
} from './icons';
import '../styles/hand-draw.css';

function fmtTime(t: number): string {
  if (!t) return '';
  const d = new Date(Number(t));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function SectionLabel({ icon, text, count }: { icon: React.ReactNode; text: string; count: number }) {
  return (
    <div className="hd-flex" style={{ gap: 6, alignItems: 'center', margin: '10px 0 6px' }}>
      {icon}
      <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', letterSpacing: '0.08em' }}>
        {text}
      </span>
      <span className="hd-pill" style={{ fontSize: 10, padding: '1px 6px' }}>{count}</span>
    </div>
  );
}

/**
 * 技能证据链面板 — P1-1
 *
 * 展示一个技能的：当前掌握度与来源、学习证据（commit）、测评证据、
 * 项目证据、简历证据、岗位影响（匹配度 delta）。
 *
 * 嵌入位置：Profile 技能清单卡片下方（inline）。
 */
export default function SkillEvidencePanel({ skillName, onClose }: { skillName: string; onClose?: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<SkillEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSkillEvidence(skillName);
      setData(res.data);
    } catch (e: any) {
      setError(e?.message || '证据链加载失败');
    } finally {
      setLoading(false);
    }
  }, [skillName]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', color: 'var(--pencil)' }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--rule)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'hd-spin 0.8s linear infinite' }} />
        <span style={{ font: '12px/1 var(--hand)' }}>正在聚合 {skillName} 的证据链…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="hd-flex-between" style={{ gap: 8, padding: '8px 4px' }}>
        <span style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)' }}>{error || '暂无证据数据'}</span>
        <button className="hd-btn small" onClick={fetchEvidence}>
          <IconRefresh size={12} style={{ marginRight: 4 }} />
          重试
        </button>
      </div>
    );
  }

  const { evidence, counts } = data;
  const total = counts.learning + counts.evaluation + counts.project + counts.resume;

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-secondary, #faf8f4)', border: '1px dashed var(--rule)', borderRadius: 10 }}>
      {/* 头部：掌握度 + summary */}
      <div className="hd-flex-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="hd-flex" style={{ gap: 8, alignItems: 'center' }}>
          <span style={{ font: '800 18px/1 var(--serif)' }}>{data.mastery}%</span>
          <span style={{ font: '11px/1.4 var(--hand)', color: 'var(--pencil)' }}>{data.summary}</span>
        </div>
        {onClose && (
          <button className="hd-btn small secondary" onClick={onClose}>收起</button>
        )}
      </div>

      {total === 0 ? (
        <div style={{ font: '12px/1.5 var(--hand)', color: 'var(--pencil)', marginTop: 8 }}>
          还没有证据。完成一次学习任务、速测或项目后，这里会自动汇总该技能的掌握依据。
          <button className="hd-btn small" style={{ marginLeft: 8 }} onClick={() => navigate('/user/learning')}>
            去学习
            <IconArrowRight size={11} style={{ marginLeft: 4 }} />
          </button>
        </div>
      ) : (
        <>
          {/* 学习证据 */}
          {evidence.learning.length > 0 && (
            <>
              <SectionLabel icon={<IconBook size={13} style={{ color: 'var(--accent)' }} />} text="学习证据" count={evidence.learning.length} />
              <div className="hd-flex-col" style={{ gap: 4 }}>
                {evidence.learning.map((c) => (
                  <div key={c.commitId} className="hd-flex-between" style={{ gap: 8, fontSize: 12 }}>
                    <span style={{ font: '12px/1.4 var(--hand)', color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{c.commitId} {c.message}
                    </span>
                    <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', flexShrink: 0 }}>{fmtTime(c.time)}</span>
                    {c.delta !== 0 && (
                      <span className="hd-pill" style={{ fontSize: 10, color: '#3a7d3a', flexShrink: 0 }}>
                        +{c.delta}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 测评证据 */}
          {evidence.evaluation.length > 0 && (
            <>
              <SectionLabel icon={<IconGradCap size={13} style={{ color: 'var(--accent)' }} />} text="测评证据" count={evidence.evaluation.length} />
              <div className="hd-flex-col" style={{ gap: 4 }}>
                {evidence.evaluation.map((r) => (
                  <div key={r.resultId} className="hd-flex-between" style={{ gap: 8, fontSize: 12 }}>
                    <span style={{ font: '12px/1.4 var(--hand)', color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.skillName || data.skill}{r.summary ? ` · ${r.summary}` : ''}
                    </span>
                    <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', flexShrink: 0 }}>{fmtTime(r.time)}</span>
                    <span className={`hd-pill ${r.passed ? '' : ''}`} style={{ fontSize: 10, color: r.passed ? '#3a7d3a' : 'var(--accent)', flexShrink: 0 }}>
                      {r.score}分{r.passed ? ' 通过' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 项目证据 */}
          {evidence.project.length > 0 && (
            <>
              <SectionLabel icon={<IconBriefcase size={13} style={{ color: 'var(--accent)' }} />} text="项目证据" count={evidence.project.length} />
              <div className="hd-flex-col" style={{ gap: 4 }}>
                {evidence.project.map((p, i) => (
                  <div key={`${p.name}-${i}`} style={{ font: '12px/1.4 var(--hand)', color: 'var(--ink)' }}>
                    <b>{p.name}</b>{p.period ? `（${p.period}）` : ''}
                    {p.description && <div style={{ color: 'var(--pencil)' }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 简历证据 */}
          {evidence.resume.length > 0 && (
            <>
              <SectionLabel icon={<IconDocument size={13} style={{ color: 'var(--accent)' }} />} text="简历表达" count={evidence.resume.length} />
              <div className="hd-flex-col" style={{ gap: 4 }}>
                {evidence.resume.map((r) => (
                  <div key={r.resumeId} style={{ font: '12px/1.4 var(--hand)', color: 'var(--ink)' }}>
                    <span style={{ color: 'var(--pencil)' }}>{r.versionName}{r.targetJobTitle ? ` · ${r.targetJobTitle}` : ''}：</span>
                    “{r.expression}”
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 岗位影响 */}
          {evidence.impact.matchDelta !== 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
              <span className="hd-pill" style={{ fontSize: 11, background: '#e8f5e9', color: '#3a7d3a' }}>
                岗位影响：{evidence.impact.jobTitle || '目标岗位'}匹配度 +{evidence.impact.matchDelta}%
              </span>
              {evidence.impact.message && (
                <span style={{ font: '11px/1.4 var(--hand)', color: 'var(--pencil)', marginLeft: 8 }}>
                  （来自 commit #{evidence.impact.commitId}）
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
