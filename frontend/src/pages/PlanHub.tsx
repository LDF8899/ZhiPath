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

export default function PlanHub() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMyPlans();
        const list = res.data || [];
        setPlans(list);
        // 没有计划 → 直接跳转创建页
        if (list.length === 0) {
          navigate('/plan/create', { replace: true });
        }
      } catch {
        navigate('/plan/create', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const handleContinue = () => {
    // 标记已看过，避免 Dashboard 再次打扰
    sessionStorage.setItem('hasSeenPlanHub', '1');
    navigate('/user/home');
  };

  const handleNewPlan = () => {
    sessionStorage.setItem('hasSeenPlanHub', '1');
    navigate('/plan/create?from=existing');
  };

  if (loading) {
    return (
      <div className="hd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: 16 }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="30 96" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </svg>
          <p style={{ font: '16px/1 var(--hand)', color: 'var(--pencil)' }}>正在检查你的学习计划…</p>
        </div>
      </div>
    );
  }

  // 有计划 → 展示选择界面
  const latestPlan = plans[0];
  const progressPct = latestPlan.totalSkills > 0
    ? Math.round((latestPlan.doneSkills / latestPlan.totalSkills) * 100)
    : 0;

  return (
    <div className="hd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ font: '800 28px/1.3 var(--serif)', color: 'var(--ink)', margin: '0 0 8px' }}>
            欢迎回来！
          </h1>
          <p style={{ font: '16px/1.5 var(--hand)', color: 'var(--pencil)' }}>
            你有一个进行中的学习计划，要继续吗？
          </p>
        </div>

        {/* 已有计划卡片 */}
        <div
          className="hd-card"
          style={{
            padding: 24,
            marginBottom: 20,
            cursor: 'pointer',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ font: '700 18px/1.3 var(--hand-bold)', color: 'var(--ink)' }}>
                {latestPlan.planName}
              </div>
              <div style={{ font: '13px/1.5 var(--hand)', color: 'var(--pencil)', marginTop: 4 }}>
                {latestPlan.planType === 'main' ? '主线计划' : '支线计划'} · 每日 {latestPlan.dailyHours}h
              </div>
            </div>
            <span className="hd-pill" style={{ background: 'var(--highlight)', color: 'var(--ink)' }}>
              进行中
            </span>
          </div>

          {/* 进度条 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>
                技能进度 {latestPlan.doneSkills}/{latestPlan.totalSkills}
              </span>
              <span style={{ font: '12px/1 var(--mono)', color: progressPct === 100 ? '#4a9d4a' : 'var(--accent)' }}>
                {progressPct}%
              </span>
            </div>
            <div className="hd-progress" style={{ height: 10 }}>
              <div
                className="hd-progress-bar"
                style={{ width: `${progressPct}%`, transition: 'width 0.5s ease' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>
              预计 {latestPlan.estimatedDate} 达成
            </span>
            <span style={{ font: '14px/1 var(--hand-bold)', color: 'var(--accent)' }}>
              继续学习 →
            </span>
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0',
          font: '14px/1 var(--hand)', color: 'var(--pencil)',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
          <span>或者</span>
          <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
        </div>

        {/* 开启新计划 */}
        <button
          className="hd-btn"
          style={{ width: '100%', padding: '14px 20px', fontSize: 16 }}
          onClick={handleNewPlan}
        >
          开启新计划
        </button>

        {plans.length > 1 && (
          <p style={{ font: '12px/1.5 var(--hand)', color: 'var(--pencil)', textAlign: 'center', marginTop: 12 }}>
            你共有 {plans.length} 个学习计划，进入主页后可切换
          </p>
        )}
      </div>
    </div>
  );
}
