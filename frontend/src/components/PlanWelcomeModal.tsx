import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPlans } from '../api/user';
import '../styles/hand-draw.css';

interface PlanSummary {
  id: number;
  planName: string;
  planType: string;
  currentPhase: number;
  dailyHours: number;
  estimatedDate: string;
  totalSkills: number;
  doneSkills: number;
  matchScore: number;
}

/**
 * 计划欢迎弹窗 — 首次进入 Dashboard 时弹出
 * 询问用户是否继续上次计划，或开启新计划
 */
export default function PlanWelcomeModal({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPlans()
      .then(res => {
        const list = res.data || [];
        setPlans(list);
        // 没有计划 → 直接关闭弹窗，让用户在 Dashboard 操作
        if (list.length === 0) {
          sessionStorage.setItem('hasSeenPlanHub', '1');
          onDone();
        }
      })
      .catch(() => {
        sessionStorage.setItem('hasSeenPlanHub', '1');
        onDone();
      })
      .finally(() => setLoading(false));
  }, [onDone]);

  const handleContinue = () => {
    sessionStorage.setItem('hasSeenPlanHub', '1');
    onDone();
  };

  const handleNewPlan = () => {
    sessionStorage.setItem('hasSeenPlanHub', '1');
    navigate('/plan/create?from=existing');
  };

  if (loading) return null;

  if (plans.length === 0) return null;

  const latest = plans[0];
  const pct = latest.totalSkills > 0
    ? Math.round((latest.doneSkills / latest.totalSkills) * 100)
    : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(43,38,32,0.3)',
      }}
      onClick={handleContinue}
    >
      <div
        className="hd-card-accent"
        style={{ maxWidth: 480, width: '90%', background: 'var(--paper)', padding: 32 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ font: '800 26px/1.3 var(--serif)', color: 'var(--ink)', margin: '0 0 8px' }}>
            欢迎回来！
          </h2>
          <p style={{ font: '15px/1.5 var(--hand)', color: 'var(--pencil)' }}>
            你有一个进行中的学习计划，要继续吗？
          </p>
        </div>

        {/* 计划卡片 */}
        <div
          className="hd-card"
          style={{
            padding: 20, marginBottom: 20, cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onClick={handleContinue}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
            (e.currentTarget as HTMLElement).style.boxShadow = '4px 5px 0 rgba(216,72,43,0.12)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '';
            (e.currentTarget as HTMLElement).style.boxShadow = '';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ font: '700 17px/1.3 var(--hand-bold)', color: 'var(--ink)' }}>
                {latest.planName}
              </div>
              <div style={{ font: '13px/1.5 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {latest.planType === 'main' ? '主线计划' : '支线计划'} · 每日 {latest.dailyHours}h
              </div>
            </div>
            <span className="hd-pill" style={{ background: 'var(--highlight)', color: 'var(--ink)' }}>
              进行中
            </span>
          </div>

          {/* 进度条 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>
                技能进度 {latest.doneSkills}/{latest.totalSkills}
              </span>
              <span style={{ font: '12px/1 var(--mono)', color: pct === 100 ? '#4a9d4a' : 'var(--accent)' }}>
                {pct}%
              </span>
            </div>
            <div className="hd-progress" style={{ height: 10 }}>
              <div className="hd-progress-bar" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>
              预计 {latest.estimatedDate} 达成
            </span>
            <span style={{ font: '14px/1 var(--hand-bold)', color: 'var(--accent)' }}>
              继续学习 →
            </span>
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, margin: '20px 0',
          font: '14px/1 var(--hand)', color: 'var(--pencil)',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
          <span>或者</span>
          <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
        </div>

        {/* 新建计划 */}
        <button
          className="hd-btn"
          style={{ width: '100%', padding: '12px 20px', fontSize: 15 }}
          onClick={handleNewPlan}
        >
          开启新计划
        </button>

        {plans.length > 1 && (
          <p style={{ font: '12px/1.5 var(--hand)', color: 'var(--pencil)', textAlign: 'center', marginTop: 12 }}>
            你共有 {plans.length} 个学习计划，可在主页切换
          </p>
        )}
      </div>
    </div>
  );
}
