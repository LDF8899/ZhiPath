import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getSkills, updateProfile } from '../../api/user';
import RadarChart from '../../components/RadarChart';
import SkillGraph3D from '../../components/SkillGraph3D';
import { useWorkspaceStore } from '../../stores/workspace';
import {
  IconUser,
  IconBook,
  IconTrophy,
  IconEdit,
  IconCheck,
  IconRefresh,
  IconLink,
  IconCode,
  IconLightbulb,
  IconChart,
  IconBriefcase,
  IconRobot,
} from '../../components/icons';
import '../../styles/hand-draw.css';
import type { UserProfile } from '../../types';

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    school: '',
    major: '',
    grade: '',
    phone: '',
    email: '',
  });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 工作区图谱快照
  const snapshot = useWorkspaceStore((s) => s.currentSnapshot);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, skillsRes] = await Promise.all([
        getProfile(),
        getSkills().catch(() => ({ data: [] })),
      ]);
      setProfile(profileRes.data);
      setSkills(skillsRes.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const startEdit = () => {
    if (!profile) return;
    setEditForm({
      name: profile.name || '',
      school: (profile as any).school || '',
      major: profile.major || '',
      grade: profile.grade || '',
      phone: (profile as any).phone || '',
      email: (profile as any).email || '',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateProfile(editForm as any);
      // Refresh profile data
      const res = await getProfile();
      setProfile(res.data);
      setEditing(false);
      setToast({ type: 'success', text: '保存成功！' });
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <div style={{ fontSize: 28, marginBottom: 8 }}>...</div>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !profile) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>:(</div>
            <p>{error || '暂无数据'}</p>
            <button className="hd-btn small" style={{ marginTop: 16 }} onClick={fetchProfile}>
              <span className="hd-flex" style={{ gap: 6 }}>
                <IconRefresh size={14} />
                重试
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const p = profile;

  // Mastery level -> badge color class
  const levelBadge = (level: string) => {
    if (level === '精通') return 'hd-badge green';
    if (level === '熟悉') return 'hd-badge accent';
    return 'hd-badge';
  };

  // Mastery percentage -> progress bar color
  const pctBarClass = (pct: number) => {
    if (pct >= 80) return 'hd-progress-bar green';
    if (pct >= 50) return 'hd-progress-bar blue';
    return 'hd-progress-bar';
  };

  // Source -> label and style
  const sourceLabel = (source: string) => {
    switch (source) {
      case 'self_report': return { text: '自评', style: { background: '#e5e7eb', color: '#6b7280' } };
      case 'conversation': return { text: '对话', style: { background: '#dbeafe', color: '#2563eb' } };
      case 'github': return { text: 'GitHub', style: { background: '#d1fae5', color: '#059669' } };
      case 'exam': return { text: '已认证', style: { background: '#fef3c7', color: '#b45309' } };
      default: return null;
    }
  };

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* Toast */}
        {toast && (
          <div className={`hd-message ${toast.type}`}>{toast.text}</div>
        )}

        <div className="hd-canvas">
          {/* ── Header ── */}
          <div className="hd-header">
            <div className="hd-flex" style={{ gap: 16 }}>
              <div className="hd-avatar large" style={{ fontSize: 28 }}>
                {(p.name || '?')[0]}
              </div>
              <div>
                <h1 style={{ font: "800 32px/1.2 var(--serif)", margin: 0 }}>
                  {p.name || '未设置'}
                </h1>
                <p style={{ font: "15px/1.4 var(--hand)", color: 'var(--pencil)', margin: '4px 0 0' }}>
                  {p.major || '未设置'}{p.grade ? ` · ${p.grade}` : ''}
                  {p.studentNo ? ` · 学号 ${p.studentNo}` : ''}
                </p>
              </div>
            </div>
            <div className="hd-flex" style={{ gap: 8 }}>
              {editing ? (
                <>
                  <button
                    className="hd-btn small"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    <span className="hd-flex" style={{ gap: 6 }}>
                      <IconCheck size={14} />
                      {saving ? '保存中...' : '保存'}
                    </span>
                  </button>
                  <button
                    className="hd-btn small secondary"
                    onClick={cancelEdit}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button className="hd-btn small secondary" onClick={startEdit}>
                  <span className="hd-flex" style={{ gap: 6 }}>
                    <IconEdit size={14} />
                    编辑资料
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="hd-grid-2" style={{ alignItems: 'start' }}>
            {/* ═══════════════════════════════════════════
                LEFT COLUMN
               ═══════════════════════════════════════════ */}
            <div className="hd-flex-col">

              {/* ── Basic Info / Edit Form ── */}
              <div className="hd-card-accent">
                <div className="hd-section-label">
                  <IconUser size={18} />
                  <h3>基本信息</h3>
                </div>
                {editing ? (
                  <div className="hd-flex-col" style={{ gap: 10 }}>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        姓名
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="姓名"
                      />
                    </div>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        学校
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.school}
                        onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                        placeholder="学校"
                      />
                    </div>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        专业
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.major}
                        onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                        placeholder="专业"
                      />
                    </div>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        年级
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.grade}
                        onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                        placeholder="年级"
                      />
                    </div>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        手机
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="手机号码"
                      />
                    </div>
                    <div>
                      <label style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', display: 'block', marginBottom: 4 }}>
                        邮箱
                      </label>
                      <input
                        className="hd-input"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="邮箱地址"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hd-flex-col" style={{ gap: 8 }}>
                    <InfoRow label="姓名" value={p.name} />
                    <InfoRow label="学校" value={(p as any).school} />
                    <InfoRow label="专业" value={p.major} />
                    <InfoRow label="年级" value={p.grade} />
                    <InfoRow label="手机" value={(p as any).phone} />
                    <InfoRow label="邮箱" value={(p as any).email} />
                    {p.goals?.targetJobTitle && (
                      <div className="hd-flex" style={{ gap: 8, padding: '8px 0 0' }}>
                        <IconBook size={16} />
                        <span style={{ font: "15px/1.4 var(--hand)", color: 'var(--ink)' }}>
                          目标：<span style={{ fontWeight: 700, color: 'var(--accent)' }}>{p.goals.targetJobTitle}</span>
                        </span>
                      </div>
                    )}
                    {p.goals?.direction && (
                      <div className="hd-flex" style={{ gap: 8 }}>
                        <IconTrophy size={16} />
                        <span style={{ font: "15px/1.4 var(--hand)", color: 'var(--ink)' }}>
                          方向：{p.goals.direction}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Traits ── */}
              {p.traits && (
                <div className="hd-card-accent">
                  <div className="hd-section-label">
                    <IconLightbulb size={18} />
                    <h3>画像标签</h3>
                  </div>
                  <div className="hd-flex-col" style={{ gap: 12 }}>
                    {p.traits.interests?.length > 0 && (
                      <div>
                        <div style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.1em' }}>
                          兴趣
                        </div>
                        <div className="hd-flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                          {p.traits.interests.map((t) => (
                            <span key={t} className="hd-tag">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {p.traits.strengths?.length > 0 && (
                      <div>
                        <div style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.1em' }}>
                          强项
                        </div>
                        <div className="hd-flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                          {p.traits.strengths.map((t) => (
                            <span key={t} className="hd-badge green">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {p.traits.weaknesses?.length > 0 && (
                      <div>
                        <div style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.1em' }}>
                          待提升
                        </div>
                        <div className="hd-flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                          {p.traits.weaknesses.map((t) => (
                            <span key={t} className="hd-badge red">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════
                RIGHT COLUMN
               ═══════════════════════════════════════════ */}
            <div className="hd-flex-col">

              {/* ── Skill List ── */}
              <div className="hd-card-accent">
                <div className="hd-section-label">
                  <IconCode size={18} />
                  <h3>技能清单</h3>
                </div>
                {p.skills?.length > 0 ? (
                  <div className="hd-grid-2" style={{ gap: 10 }}>
                    {p.skills.map((skill, i) => (
                      <div key={i} className="hd-card" style={{ padding: '10px 12px' }}>
                        <div className="hd-flex-between">
                          <span style={{ font: "15px/1 var(--hand)", color: 'var(--ink)' }}>
                            {skill.name}
                          </span>
                          <div className="hd-flex" style={{ gap: 6, alignItems: 'center' }}>
                            {(() => {
                              const match = skills.find((s: any) => s.skillName === skill.name);
                              if (match?.source) {
                                const sl = sourceLabel(match.source);
                                if (sl) {
                                  return (
                                    <span style={{ font: "11px/1 var(--mono)", padding: '2px 6px', borderRadius: 4, ...sl.style }}>
                                      {sl.text}
                                    </span>
                                  );
                                }
                              }
                              return null;
                            })()}
                            <span className={levelBadge(skill.level)}>
                              {skill.level}
                            </span>
                          </div>
                        </div>
                        {skills.length > 0 && (() => {
                          const match = skills.find((s: any) => s.skillName === skill.name);
                          if (match) {
                            const pct = Number(match.masteryPct) || 0;
                            return (
                              <div style={{ marginTop: 6 }}>
                                <div className="hd-progress">
                                  <div className={pctBarClass(pct)} style={{ width: `${pct}%` }} />
                                </div>
                                <div style={{ font: "11px/1 var(--mono)", color: 'var(--pencil)', marginTop: 3, textAlign: 'right' }}>
                                  {pct}%
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ font: "15px/1.4 var(--hand)", color: 'var(--pencil)' }}>
                    暂无技能记录
                  </p>
                )}
              </div>

              {/* ── Radar Chart ── */}
              {skills.length >= 3 && (
                <div className="hd-card-accent">
                  <div className="hd-section-label">
                    <IconChart size={18} />
                    <h3>技能雷达</h3>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <RadarChart
                      data={skills.slice(0, 8).map((s: any) => ({
                        label: s.skillName?.substring(0, 6) || '',
                        value: Number(s.masteryPct) || 0,
                        max: 100,
                      }))}
                      size={220}
                      color="#d8482b"
                      bgColor="#fbf6ec"
                    />
                  </div>
                </div>
              )}

              {/* ── Projects ── */}
              <div className="hd-card-accent">
                <div className="hd-section-label" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <div className="hd-flex" style={{ gap: 12 }}>
                    <IconBriefcase size={18} />
                    <h3>项目经历</h3>
                  </div>
                  <button
                    className="hd-btn small secondary"
                    style={{ padding: '6px 10px', font: "12px/1 var(--hand)" }}
                    onClick={() => {/* navigate to projects edit */}}
                  >
                    <span className="hd-flex" style={{ gap: 4 }}>
                      <IconEdit size={12} />
                      编辑
                    </span>
                  </button>
                </div>
                {p.projects?.length > 0 ? (
                  <div className="hd-flex-col" style={{ gap: 12 }}>
                    {p.projects.map((proj, i) => (
                      <div key={i} className="hd-card">
                        <div className="hd-flex-between" style={{ marginBottom: 6 }}>
                          <div>
                            <h4 style={{ font: "700 16px/1.3 var(--hand-bold)", margin: 0, color: 'var(--ink)' }}>
                              {proj.name}
                            </h4>
                            <p style={{ font: "13px/1.4 var(--hand)", color: 'var(--pencil)', margin: '2px 0 0' }}>
                              {proj.role}{proj.time ? ` · ${proj.time}` : ''}
                            </p>
                          </div>
                          {proj.githubUrl && (
                            <a
                              href={proj.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--pencil)' }}
                            >
                              <IconLink size={16} />
                            </a>
                          )}
                        </div>
                        {proj.description && (
                          <p style={{ font: "14px/1.5 var(--hand)", color: 'var(--pencil)', margin: '0 0 8px' }}>
                            {proj.description}
                          </p>
                        )}
                        {proj.tech?.length > 0 && (
                          <div className="hd-flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {proj.tech.map((t) => (
                              <span key={t} className="hd-pill">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ font: "15px/1.4 var(--hand)", color: 'var(--pencil)' }}>
                    暂无项目经历，可通过 GitHub 导入或手动添加
                  </p>
                )}
              </div>

              {/* ── 3D 知识图谱 ── */}
              {snapshot && snapshot.nodes.length > 0 && (
                <div className="hd-card-accent">
                  <div className="hd-section-label">
                    <IconChart size={18} />
                    <h3>知识图谱 3D</h3>
                  </div>
                  <div
                    style={{ height: 420, position: 'relative', borderRadius: 8, overflow: 'hidden' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const agentKey = e.dataTransfer.getData('application/zhipath-agent');
                      if (agentKey && selectedNode) {
                        navigate(`/user/chat?agent=${agentKey}&node=${selectedNode}&auto=1`);
                      }
                    }}
                  >
                    <SkillGraph3D
                      snapshot={snapshot}
                      selectedNodeId={selectedNode}
                      onNodeClick={setSelectedNode}
                    />
                  </div>
                  {selectedNode && (
                    <div style={{ marginTop: 8, font: '13px/1.4 var(--hand)', color: 'var(--pencil)' }}>
                      已选中节点：<span style={{ color: 'var(--ink)', fontWeight: 700 }}>{selectedNode}</span>
                      <span style={{ marginLeft: 8, font: '11px/1 var(--mono)' }}>（可拖拽智能体到图谱派发任务）</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Insights ── */}
              {p.chatInsights?.length > 0 && (
                <div className="hd-dashed">
                  <div className="hd-section-label">
                    <IconRobot size={18} />
                    <h3>AI 洞察</h3>
                  </div>
                  <div className="hd-flex-col" style={{ gap: 8 }}>
                    {p.chatInsights.map((insight, i) => (
                      <div
                        key={i}
                        className="hd-note yellow"
                        style={{ maxWidth: 'none', transform: `rotate(${(i % 2 === 0 ? 1.2 : -1.8)}deg)` }}
                      >
                        <div className="hd-note-tape" />
                        {insight.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper: info row for view mode ── */
function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="hd-flex-between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--rule)' }}>
      <span style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span style={{ font: "15px/1 var(--hand)", color: value ? 'var(--ink)' : 'var(--rule)' }}>
        {value || '未设置'}
      </span>
    </div>
  );
}

