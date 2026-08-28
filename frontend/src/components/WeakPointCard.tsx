import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { remediationApi } from '../api/remediation';
import { IconTarget } from './icons';
import '../styles/hand-draw.css';

interface HistoryItem {
  id: number;
  taskId: number | null;
  createTime: number;
  topics: Array<{ label: string; beforeMastery: number; currentMastery: number; delta: number }>;
}

export default function WeakPointCard() {
  const navigate = useNavigate();
  const [weak, setWeak] = useState<Array<{ label: string; masteryPct: number }>>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.allSettled([remediationApi.weakPoints(), remediationApi.history(5)])
      .then(([w, h]) => { if (w.status === 'fulfilled' && w.value.data) setWeak(w.value.data); if (h.status === 'fulfilled' && h.value.data) setHistory(h.value.data); })
      .finally(() => setLoading(false));
  }, []);

  const remediate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await remediationApi.generate({ count: 5, difficulty: 6, questionTypes: ['choice', 'fill'] });
      const taskId = res.data?.taskId;
      if (taskId) navigate(`/user/question-generator?taskId=${taskId}`);
      else alert('补弱出题未返回任务，请稍后再试');
    } catch (e: any) { alert(`补弱出题失败：${e?.message || ''}`); }
    finally { setBusy(false); }
  };

  const recentGains = history.slice(0, 2).flatMap((r) => r.topics.map((t) => t));
  if (loading) return null;
  if (!weak.length && !recentGains.length) return null;

  return (
    <div className="hd-card" style={{ marginBottom: 16 }}>
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div className="hd-flex" style={{ gap: 8 }}>
          <IconTarget size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>成长画像 · 薄弱与补强</span>
        </div>
        {weak.length > 0 && <span className="hd-badge">{weak.length} 项薄弱</span>}
      </div>

      {weak.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weak.slice(0, 5).map((w) => (
            <div key={w.label} className="hd-flex-between" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--ink)' }}>{w.label}</span>
              <span style={{ color: 'var(--accent)' }}>掌握 {Math.round(w.masteryPct)}%</span>
            </div>
          ))}
        </div>
      )}

      {recentGains.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
          <div style={{ fontSize: 12, color: 'var(--pencil)', marginBottom: 6 }}>近期补强效果</div>
          {recentGains.map((t) => (
            <div key={t.label} className="hd-flex-between" style={{ fontSize: 12.5 }}>
              <span style={{ color: 'var(--pencil)' }}>{t.label}</span>
              <span style={{ color: t.delta > 0 ? '#3a7d3a' : 'var(--pencil)' }}>
                {Math.round(t.beforeMastery)}% → {Math.round(t.currentMastery)}%{t.delta !== 0 ? `（${t.delta > 0 ? '+' : ''}${t.delta}）` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="hd-btn small" style={{ marginTop: 12, width: '100%' }} disabled={busy} onClick={remediate}>
        {busy ? '补弱出题中...' : '一键补弱出题（由浅入深）'}
      </button>
    </div>
  );
}
