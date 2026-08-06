import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGapCard, importJobSkills } from '../api/user';
import type { GapCard, GapCardTopGap } from '../types';
import {
  IconTarget,
  IconBook,
  IconGradCap,
  IconBriefcase,
  IconDocument,
  IconArrowRight,
  IconRefresh,
} from './icons';
import '../styles/hand-draw.css';

/* ── 推荐动作 → 页面跳转映射 ── */
type ActionIconType = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const ACTION_META: Record<
  GapCardTopGap['actionTarget'],
  { path: string; label: string; icon: ActionIconType }
> = {
  learning: { path: '/user/learning', label: '去学习', icon: IconBook },
  'quick-test': { path: '/user/quick-test', label: '去速测', icon: IconGradCap },
  project: { path: '/user/projects', label: '去项目', icon: IconBriefcase },
  resume: { path: '/user/resume', label: '去简历', icon: IconDocument },
  plan: { path: '/plan/create?type=side', label: '去创建', icon: IconTarget },
};

function scoreColor(score: number): string {
  if (score >= 80) return '#3a7d3a';
  if (score >= 60) return 'var(--data-blue, #2f6fed)';
  return 'var(--accent)';
}

/**
 * 岗位差距卡 — P0-1
 *
 * 展示：当前匹配度、投递建议、Top 3 缺口（含掌握度）、推荐动作与预计影响、
 * 无画像兜底提示、一键加入学习计划。
 *
 * 页面位置：首页顶部（compact）、岗位详情右侧（完整）。
 */
export default function JobGapCard({
  jobId,
  compact = false,
  showHeader = true,
  bare = false,
  onScoreChange,
}: {
  jobId: number;
  compact?: boolean;
  showHeader?: boolean;
  /** 无边框模式：嵌入其它卡片容器时使用 */
  bare?: boolean;
  onScoreChange?: (score: number | null) => void;
}) {
  const navigate = useNavigate();
  const [card, setCard] = useState<GapCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const fetchCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    // 重置外部分数，避免切换目标岗位后残留旧岗位分数
    onScoreChange?.(null);
    try {
      const res = await getGapCard(jobId);
      setCard(res.data);
      onScoreChange?.(res.data.score);
    } catch (e: any) {
      setError(e?.message || '差距卡加载失败');
    } finally {
      setLoading(false);
    }
  }, [jobId, onScoreChange]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const handleAddToPlan = async () => {
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await importJobSkills(jobId, 'side');
      if (res.code === 200 && res.data) {
        if (res.data.error) {
          // 无学习计划 → 引导创建
          setAddMsg(res.data.error);
          navigate('/plan/create?type=side');
        } else {
          setAddMsg(res.data.message || `已加入学习计划`);
        }
      } else {
        setAddMsg('添加失败，请稍后重试');
      }
    } catch (e: any) {
      setAddMsg(e?.message || '添加失败，请稍后重试');
    } finally {
      setAdding(false);
    }
  };

  const go = (path: string) => navigate(path);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={bare ? '' : 'hd-card'} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--pencil)' }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--rule)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'hd-spin 0.8s linear infinite' }} />
        <span style={{ font: '13px/1 var(--hand)' }}>正在分析岗位差距…</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !card) {
    return (
      <div className={bare ? '' : 'hd-card'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>{error || '暂无差距数据'}</span>
        <button className="hd-btn small" onClick={fetchCard}>
          <IconRefresh size={13} style={{ marginRight: 4 }} />
          重试
        </button>
      </div>
    );
  }

  const color = scoreColor(card.score);
  const gaps = card.topGaps;

  return (
    <div
      className={bare ? '' : 'hd-card'}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, ...(bare ? { width: '100%' } : {}) }}
    >
      {/* 头部：岗位名 + 匹配度 */}
      <div className="hd-flex-between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {showHeader && (
            <div className="hd-flex" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <IconTarget size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ font: '13px/1.3 var(--serif)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.jobTitle}
              </span>
            </div>
          )}
          <div className="hd-flex" style={{ alignItems: 'baseline', gap: 6 }}>
            <span style={{ font: '800 30px/1 var(--serif)', color }}>{Math.round(card.score)}%</span>
            <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', letterSpacing: '0.08em' }}>
              当前匹配度
            </span>
          </div>
          <div style={{ marginTop: 6, font: '12px/1.5 var(--hand)', color: 'var(--pencil)' }}>
            {card.hasProfile ? card.applyAdvice : card.message || card.applyAdvice}
          </div>
        </div>
        {/* 匹配度进度条 */}
        <div style={{ width: compact ? 70 : 90, flexShrink: 0 }}>
          <div style={{ height: 8, background: 'var(--bg-secondary, #eee)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, card.score)}%`,
                height: '100%',
                borderRadius: 4,
                background: color,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
          {!compact && card.totalEstimatedImpact > 0 && (
            <div style={{ marginTop: 8, font: '11px/1.4 var(--hand)', color: '#3a7d3a', textAlign: 'right' }}>
              补齐缺口预计 +{card.totalEstimatedImpact}%
            </div>
          )}
        </div>
      </div>

      {/* 无画像提示 */}
      {!card.hasProfile && (
        <div
          className="hd-tag"
          style={{ alignSelf: 'flex-start', background: '#fff3e0', color: '#e65100', fontSize: 11, padding: '4px 10px', borderRadius: 4 }}
        >
          先完善技能画像，差距卡会更准
        </div>
      )}

      {/* Top 3 缺口 */}
      {gaps.length > 0 && (
        <div className="hd-flex-col" style={{ gap: 8 }}>
          <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', letterSpacing: '0.1em' }}>
            关键缺口 TOP {Math.min(3, gaps.length)}
          </div>
          {gaps.map((g, i) => {
            const meta = ACTION_META[g.actionTarget];
            const ActionIcon = meta.icon;
            return (
              <div
                key={`${g.skill}-${i}`}
                className="hd-flex-between"
                style={{
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--bg-secondary, #faf8f4)',
                  borderRadius: 8,
                  border: '1px dashed var(--rule)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="hd-flex" style={{ gap: 6, alignItems: 'center' }}>
                    <span style={{ font: '13px/1.3 var(--serif)', fontWeight: 600 }}>
                      {g.skill}
                    </span>
                    {g.type === 'required' ? (
                      <span className="hd-pill" style={{ fontSize: 10, padding: '2px 6px' }}>必备</span>
                    ) : (
                      <span className="hd-pill" style={{ fontSize: 10, padding: '2px 6px' }}>加分</span>
                    )}
                  </div>
                  <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginTop: 3 }}>
                    {g.recommendedAction}
                  </div>
                  {/* P1-2：缺口判断依据 — 证据覆盖状态 */}
                  {g.evidence && (
                    <div style={{ font: '11px/1.4 var(--hand)', marginTop: 3 }}>
                      {g.evidence.hasEvidence ? (
                        <span style={{ color: '#3a7d3a' }}>
                          ✓ 已有 {g.evidence.count} 条相关证据（{g.evidence.items.map((it: any) => it.title).join('、')}）
                        </span>
                      ) : (
                        <span style={{ color: 'var(--accent)' }}>✗ 暂无相关证据，优先补齐后再投递</span>
                      )}
                    </div>
                  )}
                  {!compact && (
                    <div style={{ font: '11px/1 var(--mono)', color: '#3a7d3a', marginTop: 4 }}>
                      预计 +{g.estimatedImpact}% 匹配度
                    </div>
                  )}
                </div>
                <div className="hd-flex" style={{ gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>{g.currentMastery}%</span>
                  {!compact && (
                    <button className="hd-btn small" onClick={() => go(meta.path)} title={meta.label}>
                      <ActionIcon size={12} style={{ marginRight: 4 }} />
                      {meta.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 无缺口时 */}
      {gaps.length === 0 && card.hasProfile && (
        <div style={{ font: '13px/1.5 var(--hand)', color: '#3a7d3a' }}>
          必备技能已覆盖，可准备投递或优化简历表达。
        </div>
      )}

      {/* 底部操作 */}
      <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="hd-btn small highlight" onClick={handleAddToPlan} disabled={adding}>
          <IconTarget size={13} style={{ marginRight: 5 }} />
          {adding ? '加入中…' : '一键加入学习计划'}
        </button>
        <button className="hd-btn small secondary" onClick={() => go(`/user/jobs/${card.jobId}`)}>
          查看岗位详情
          <IconArrowRight size={12} style={{ marginLeft: 5 }} />
        </button>
      </div>
      {addMsg && (
        <div style={{ font: '12px/1.4 var(--hand)', color: addMsg.includes('失败') ? 'var(--accent)' : '#3a7d3a' }}>
          {addMsg}
        </div>
      )}
    </div>
  );
}
