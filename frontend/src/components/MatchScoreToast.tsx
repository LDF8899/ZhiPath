import { useEffect, useState, useCallback } from 'react';
import '../styles/hand-draw.css';
import { IconTrophy } from './icons';

interface MatchScoreToastProps {
  oldScore: number;
  newScore: number;
  jobTitle?: string;
}

/**
 * 匹配度变化 Toast 组件
 */
export function useMatchScoreToast() {
  const [toast, setToast] = useState<{ key: number; node: React.ReactNode } | null>(null);

  const showMatchScoreChange = useCallback((oldScore: number, newScore: number, jobTitle?: string) => {
    const diff = newScore - oldScore;
    if (Math.abs(diff) < 1) return;

    const isIncrease = diff > 0;

    setToast({
      key: Date.now(),
      node: (
        <div className={`hd-message ${isIncrease ? 'success' : 'error'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isIncrease && <IconTrophy size={20} />}
            <div>
              <div style={{ fontWeight: 800, fontFamily: 'var(--hand-bold)', fontSize: 16 }}>
                {isIncrease ? '匹配度提升！' : '匹配度变化'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--serif)' }}>{newScore}%</span>
                <span style={{ fontSize: 13, color: isIncrease ? '#3a7d3a' : 'var(--accent)', fontFamily: 'var(--mono)' }}>
                  {isIncrease ? '+' : ''}{diff.toFixed(1)}%
                </span>
              </div>
              {jobTitle && <div style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 2 }}>目标岗位：{jobTitle}</div>}
            </div>
          </div>
        </div>
      ),
    });

    setTimeout(() => setToast(null), 4000);
  }, []);

  const contextHolder = toast ? toast.node : null;

  return { contextHolder, showMatchScoreChange };
}

/**
 * 考试通过庆祝动画
 */
export function useCelebration() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  const celebrate = (msg: string) => {
    setMessage(msg);
    setShow(true);
    setTimeout(() => setShow(false), 3000);
  };

  const CelebrationOverlay = show ? (
    <div className="hd-page" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', background: 'rgba(251,246,236,0.85)',
    }}>
      <div style={{ textAlign: 'center', animation: 'hd-msg-in 0.4s ease-out' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>
          <IconTrophy size={64} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ font: '800 28px/1.2 var(--serif)', color: 'var(--ink)' }}>{message}</div>
        <div style={{ fontSize: 14, color: 'var(--pencil)', marginTop: 8, fontFamily: 'var(--hand)' }}>太棒了，继续加油！</div>
      </div>
    </div>
  ) : null;

  return { celebrate, CelebrationOverlay };
}

/**
 * 连续学习天数激励
 */
export function StreakBanner({ days }: { days: number }) {
  if (days < 2) return null;

  const getMessage = (d: number) => {
    if (d >= 30) return '坚持一个月了！太厉害了！';
    if (d >= 14) return '连续两周，保持节奏！';
    if (d >= 7) return '一周连续学习，习惯已养成！';
    return `连续学习 ${d} 天，继续加油！`;
  };

  return (
    <div className="hd-card hd-tilt-2" style={{ background: 'var(--highlight)', marginBottom: 16 }}>
      <div className="hd-flex" style={{ gap: 12 }}>
        <span className="hd-avatar large" style={{ background: 'var(--accent)', color: 'var(--paper)', fontSize: 24 }}>
          {days >= 30 ? '30+' : `${days}`}
        </span>
        <div>
          <div style={{ fontWeight: 800, fontFamily: 'var(--hand-bold)', fontSize: 16 }}>{getMessage(days)}</div>
          <div style={{ fontSize: 12, color: 'var(--pencil)' }}>已连续学习 {days} 天</div>
        </div>
      </div>
    </div>
  );
}
