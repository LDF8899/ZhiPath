import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGrowthReport } from '../../api/user';
import {
  IconBook,
  IconGradCap,
  IconTrophy,
  IconFire,
  IconTarget,
  IconArrowRight,
  IconRefresh,
  IconDownload,
} from '../../components/icons';
import EmptyState from '../../components/EmptyState';
import '../../styles/hand-draw.css';

function fmtTime(t: number): string {
  if (!t) return '';
  const d = new Date(Number(t));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMin(min: number): string {
  if (min >= 60) return `${Math.round(min / 60 * 10) / 10} 小时`;
  return `${min} 分钟`;
}

const TYPE_LABEL: Record<string, string> = {
  lecture_read: '学习讲义',
  quiz_passed: '测评通过',
  quiz_failed: '测评未过',
  code_done: '完成编程',
  skill_complete: '技能达成',
  task_done: '完成任务',
  manual: '手动记录',
  merge: '合并分支',
  rollback: '回滚',
};

/**
 * 阶段成长报告 — P2-2
 *
 * 展示近 7/30 天：学习记录、技能变化、测评表现、岗位匹配变化、下一步建议。
 * 页面报告（不急于 PDF），可用于演示与就业指导。
 */
export default function GrowthReport() {
  const navigate = useNavigate();
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGrowthReport(d);
      setData(res.data);
    } catch (e: any) {
      setError(e?.message || '报告加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(days); }, [days, fetchReport]);

  const s = data?.summary || null;
  const reportVerdict = s
    ? s.commits === 0
      ? '本期还没有形成学习证据，建议先完成 1 个今日任务和 1 次速测。'
      : s.matchDelta > 0
        ? `本期岗位匹配度提升 ${s.matchDelta}%，学习成果已经进入岗位闭环。`
        : s.examCount === 0
          ? '本期已有学习推进，但缺少测评证据，建议用速测把掌握度沉淀下来。'
          : '本期学习记录已沉淀，下一步建议补项目证据或优化岗位版简历。'
    : '';

  return (
    <div className="hd-canvas growth-report-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {/* 头部：标题 + 周期切换 + 刷新 */}
      <div className="hd-flex-between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div className="hd-section-label" style={{ marginBottom: 6 }}>
            <IconTrophy size={18} />
            <h2 style={{ fontSize: 20 }}>阶段成长报告</h2>
          </div>
          <div style={{ font: '13px/1.5 var(--hand)', color: 'var(--pencil)' }}>
            {data ? `${data.period?.start} ~ ${data.period?.end} · ${data.days} 天` : '学习成果一页看懂'}
          </div>
        </div>
        <div className="hd-flex" style={{ gap: 8 }}>
          {[7, 30].map((d) => (
            <button
              key={d}
              className={`hd-btn small ${days === d ? '' : 'secondary'}`}
              onClick={() => setDays(d as 7 | 30)}
            >
              近 {d} 天
            </button>
          ))}
          <button className="hd-btn small secondary" onClick={() => fetchReport(days)} disabled={loading}>
            <IconRefresh size={13} style={{ marginRight: 4 }} />
            刷新
          </button>
          <button className="hd-btn small highlight" onClick={() => window.print()} disabled={loading || !s}>
            <IconDownload size={13} style={{ marginRight: 4 }} />
            打印/保存
          </button>
        </div>
      </div>

      {error && <div className="hd-dashed" style={{ color: 'var(--accent)', marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div className="hd-empty" style={{ padding: 48 }}>正在生成报告…</div>
      ) : s ? (
        <>
          <div className="growth-report-verdict">
            <div>
              <span className="hd-badge accent">本期结论</span>
              <strong>{reportVerdict}</strong>
              <p>
                报告覆盖学习 commit、任务完成、测评表现、技能变化和岗位匹配变化，可用于阶段复盘或就业指导沟通。
              </p>
            </div>
            <button className="hd-btn small secondary" onClick={() => navigate('/user/learning')}>
              继续今日任务
              <IconArrowRight size={12} style={{ marginLeft: 5 }} />
            </button>
          </div>

          {/* ── 概览卡 ── */}
          <div className="hd-grid-4" style={{ gap: 12, marginBottom: 14 }}>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-flex" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <IconFire size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>学习天数 / 时长</span>
              </div>
              <div style={{ font: '800 24px/1 var(--serif)' }}>
                {s.learningDays} 天 <span style={{ fontSize: 14, color: 'var(--pencil)' }}>/ {fmtMin(s.learnedMin)}</span>
              </div>
              <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {s.commits} 次学习 commit · 完成 {s.tasksDone}/{s.totalTasks} 个任务（{s.taskRate}%）
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-flex" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <IconGradCap size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>测评表现</span>
              </div>
              <div style={{ font: '800 24px/1 var(--serif)' }}>
                {s.avgExamScore} <span style={{ fontSize: 14, color: 'var(--pencil)' }}>均分</span>
              </div>
              <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {s.examCount} 次测评 · 达标率 {s.examPassRate}%
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-flex" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <IconTarget size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>岗位匹配变化</span>
              </div>
              <div style={{ font: '800 24px/1 var(--serif)' }}>
                {s.matchBefore}% <span style={{ fontSize: 14, color: 'var(--pencil)' }}>→</span> {s.matchNow}%
                {s.matchDelta !== 0 && (
                  <span style={{ fontSize: 14, color: s.matchDelta > 0 ? '#3a7d3a' : 'var(--accent)' }}>
                    {s.matchDelta > 0 ? '+' : ''}{s.matchDelta}%
                  </span>
                )}
              </div>
              <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {s.jobTitle || '未绑定目标岗位'}
              </div>
            </div>
            <div className="hd-card-accent" style={{ padding: 14 }}>
              <div className="hd-flex" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <IconBook size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>技能变化</span>
              </div>
              <div style={{ font: '800 24px/1 var(--serif)' }}>{s.commits}</div>
              <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {s.commits > 0 ? '持续学习中，保持节奏' : '暂无学习记录'}
              </div>
            </div>
          </div>

          {/* ── 下一步建议 ── */}
          {data.recommendations?.length > 0 && (
            <div className="hd-card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid var(--accent)' }}>
              <div className="hd-section-label" style={{ marginBottom: 8 }}>
                <IconTarget size={16} />
                <h3 style={{ fontSize: 16 }}>下一步建议</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, font: '14px/1.7 var(--hand)' }}>
                {data.recommendations.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="hd-grid-2" style={{ gap: 12 }}>
            {/* ── 技能变化 ── */}
            <div className="hd-card" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 10 }}>
                <IconTrophy size={16} />
                <h3 style={{ fontSize: 16 }}>技能变化 Top 5</h3>
              </div>
              {data.skillChanges?.length > 0 ? (
                <div className="hd-flex-col" style={{ gap: 8 }}>
                  {data.skillChanges.map((c: any) => (
                    <div key={c.skill} className="hd-flex" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ font: '13px/1 var(--hand)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.skill}
                      </span>
                      <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', width: 56, flexShrink: 0 }}>
                        {c.from}% → {c.to}%
                      </span>
                      <div className="hd-progress" style={{ height: 8, flex: 1 }}>
                        <div
                          className="hd-progress-bar"
                          style={{ width: `${Math.min(100, c.to)}%`, background: c.delta >= 0 ? '#3a7d3a' : 'var(--accent)' }}
                        />
                      </div>
                      <span style={{ font: '12px/1 var(--mono)', width: 44, textAlign: 'right', color: c.delta >= 0 ? '#3a7d3a' : 'var(--accent)', flexShrink: 0 }}>
                        {c.delta >= 0 ? '+' : ''}{c.delta}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon="book"
                  title="窗口内暂无技能变化"
                  description="完成学习任务或测评后，这里会显示掌握度变化。"
                  actionLabel="去学习"
                  onAction={() => navigate('/user/learning')}
                />
              )}

              {/* ── 测评趋势 ── */}
              <div className="hd-section-label" style={{ margin: '16px 0 10px' }}>
                <IconGradCap size={16} />
                <h3 style={{ fontSize: 16 }}>近期测评</h3>
              </div>
              {data.examTrend?.length > 0 ? (
                <div className="hd-flex-col" style={{ gap: 6 }}>
                  {data.examTrend.map((e: any, i: number) => (
                    <div key={i} className="hd-flex-between" style={{ gap: 8, fontSize: 12 }}>
                      <span style={{ font: '12px/1.4 var(--hand)', color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.skillName || '综合测评'}
                      </span>
                      <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', flexShrink: 0 }}>{e.date}</span>
                      <span className="hd-pill" style={{ fontSize: 10, color: e.passed ? '#3a7d3a' : 'var(--accent)', flexShrink: 0 }}>
                        {e.score}分{e.passed ? ' 达标' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon="test"
                  title="暂无测评记录"
                  description="做一次速测，把学习结果变成能力证据。"
                  actionLabel="去速测"
                  onAction={() => navigate('/user/quick-test')}
                />
              )}
            </div>

            {/* ── commit 时间线 ── */}
            <div className="hd-card" style={{ padding: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 10 }}>
                <IconBook size={16} />
                <h3 style={{ fontSize: 16 }}>学习时间线（commit）</h3>
              </div>
              {data.commitTimeline?.length > 0 ? (
                <div className="hd-flex-col" style={{ gap: 8 }}>
                  {data.commitTimeline.map((c: any) => (
                    <div key={c.commitId} className="hd-flex" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="hd-flex-between" style={{ gap: 8 }}>
                          <span style={{ font: '13px/1.3 var(--hand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {TYPE_LABEL[c.type] || c.type} · {c.message}
                          </span>
                          {c.delta !== 0 && (
                            <span className="hd-pill" style={{ fontSize: 10, color: '#3a7d3a', flexShrink: 0 }}>
                              +{c.delta}%
                            </span>
                          )}
                        </div>
                        <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', marginTop: 2 }}>
                          #{c.commitId} · {fmtTime(c.time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon="book"
                  title="窗口内暂无学习记录"
                  description="完成任务后会生成 commit，并记录技能 delta。"
                  actionLabel="去学习"
                  onAction={() => navigate('/user/learning')}
                />
              )}

              <button
                className="hd-btn small secondary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={() => navigate('/user/progress')}
              >
                查看完整 Git 式成长记录
                <IconArrowRight size={12} style={{ marginLeft: 5 }} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon="target"
          title="暂无成长报告数据"
          description="先完成画像、绑定目标岗位并开始第一个学习任务。"
          actionLabel="回到首页"
          onAction={() => navigate('/user/home')}
        />
      )}
    </div>
  );
}
