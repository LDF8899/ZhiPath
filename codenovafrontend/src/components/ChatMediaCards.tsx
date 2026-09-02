import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Film,
  GitBranch,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { multimodalApi } from '../lib/api';
import { Bar } from './ui';

/**
 * 聊天里的多模态资源卡片 —— 移植自老前端 Chat（DiagramCard / AnimationCard / VideoCard），
 * 配色对齐新前端。三个卡片共同解决"资源在聊天中的展示 + 切页恢复"：
 *   - DiagramCard：动态加载 mermaid 渲染 LLM 源码，失败回退源码展示
 *   - AnimationCard：沙箱 iframe 渲染自包含 HTML 动画
 *   - VideoCard：轮询视频任务进度（Redis 持久化兜底），切页回来重新挂载即恢复状态
 */

// ────────────────────────────────────────────────────────────
//  Mermaid 图表卡片
// ────────────────────────────────────────────────────────────

let mermaidReady = false;

export function DiagramCard({ data }: { data: { skill?: string; title?: string; mermaid?: string; diagramType?: string } }) {
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  const [showSource, setShowSource] = useState(false);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    if (!data?.mermaid) {
      setErr('图表源码为空');
      return;
    }
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidReady) {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
          mermaidReady = true;
        }
        const { svg: rendered } = await mermaid.render(idRef.current, (data.mermaid || '').trim());
        if (!cancelled) {
          setSvg(rendered);
          setErr('');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '图表渲染失败');
      }
    })();
    return () => { cancelled = true; };
  }, [data?.mermaid]);

  return (
    <div className="col" style={{ gap: 8, width: '100%' }}>
      <div className="row" style={{ gap: 8 }}>
        <GitBranch size={15} style={{ color: 'var(--brand-600)' }} />
        <span className="small" style={{ fontWeight: 700 }}>{data.title || `${data.skill || '知识'} 图解`}</span>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowSource((prev) => !prev)}
        >
          {showSource ? '看图' : '看源码'}
        </button>
      </div>

      {showSource ? (
        <pre className="tiny muted" style={{ margin: 0, padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {data.mermaid}
        </pre>
      ) : err ? (
        <div className="col" style={{ gap: 6 }}>
          <span className="tiny" style={{ color: 'var(--amber-600)' }}>图表渲染失败：{err}（已展示源码）</span>
          <pre className="tiny muted" style={{ margin: 0, padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {data.mermaid}
          </pre>
        </div>
      ) : svg ? (
        <div
          style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fff', overflow: 'auto', textAlign: 'center' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="small muted" style={{ padding: 20, textAlign: 'center' }}>正在渲染图表…</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  HTML 动画卡片（沙箱 iframe）
// ────────────────────────────────────────────────────────────

export function AnimationCard({ data }: { data: { skill?: string; title?: string; html?: string } }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  if (!data?.html) {
    return <p className="small muted">动画内容为空</p>;
  }

  const openInNewTab = () => {
    const blob = new Blob([data.html!], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="col" style={{ gap: 8, width: '100%' }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 700 }}>{data.title || `${data.skill || '知识'} 动画演示`}</span>
        <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
          <button type="button" className="btn btn--quiet btn--sm" title="重新播放" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw size={13} />
          </button>
          <button type="button" className="btn btn--quiet btn--sm" title="新标签打开" onClick={openInNewTab}>
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <iframe
          key={reloadKey}
          title={`anim-${data.skill || 'demo'}`}
          srcDoc={data.html}
          sandbox="allow-scripts"
          style={{ width: '100%', height: expanded ? 500 : 320, border: 'none', display: 'block' }}
        />
      </div>
      <div>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? '收起' : '放大'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  教学视频卡片（进度轮询 + 内联播放）
// ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  pending: '准备中…',
  script: '正在生成视频脚本',
  tts: '正在合成配音',
  render: '正在渲染视频画面',
  compose: '正在合成成片',
};

function getVideoSrc(result: any): string {
  if (result?.url) return result.url;
  const videoPath = result?.video_file_path || result?.videoFilePath || result?.video_file || '';
  const filename = String(videoPath).split('/').pop() || String(videoPath).split('\\').pop() || '';
  return filename ? `/api/video/${filename}` : '';
}

export function VideoCard({ data }: { data: { taskId?: string; skillName?: string; skill?: string; difficulty?: string; status?: string; message?: string; video_file_path?: string; url?: string } }) {
  const initialResult = data?.video_file_path || data?.url ? data : null;
  const [state, setState] = useState<{
    status: string;
    progress: number;
    message: string;
    result: any;
    error: string;
    elapsedSec: number;
  }>({
    status: data?.status || (initialResult ? 'completed' : 'pending'),
    progress: 0,
    message: data?.message || '',
    result: initialResult,
    error: '',
    elapsedSec: 0,
  });
  const [activeTaskId, setActiveTaskId] = useState(data?.taskId || '');
  const [regenerating, setRegenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  // 轮询：挂载即查一次（切页回来天然恢复状态），此后每 3 秒
  useEffect(() => {
    if (!activeTaskId || data?.status === 'completed' || data?.status === 'failed') return;
    let notFound = 0;
    const poll = async () => {
      try {
        const task = await multimodalApi.videoTask(activeTaskId);
        if (task) {
          notFound = 0;
          setState({
            status: String(task.status || 'pending'),
            progress: Number(task.progress) || 0,
            message: String(task.message || ''),
            result: task.result,
            error: String(task.error || ''),
            elapsedSec: Number(task.elapsedSec) || Math.round((Date.now() - startRef.current) / 1000),
          });
          if (task.status === 'completed' || task.status === 'failed') {
            if (timerRef.current) clearInterval(timerRef.current);
          }
        } else {
          notFound += 1;
          if (notFound >= 2) {
            setState((prev) => ({ ...prev, status: 'expired', message: '任务已过期或服务已重启，请重新生成' }));
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      } catch {
        // 单次网络错误不中断轮询
      }
    };
    poll();
    timerRef.current = setInterval(poll, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeTaskId, data?.status]);

  const handleRegenerate = useCallback(async () => {
    const skill = data?.skillName || data?.skill || '';
    if (!skill) return;
    setRegenerating(true);
    setState({ status: 'pending', progress: 0, message: '正在重新生成…', result: null, error: '', elapsedSec: 0 });
    startRef.current = Date.now();
    try {
      const result = await multimodalApi.video(skill);
      // 返回的是 video_pending 结构，data.taskId 是新任务
      const nextTaskId = result?.data?.taskId || result?.taskId;
      if (nextTaskId) setActiveTaskId(nextTaskId);
      else setState((prev) => ({ ...prev, status: 'failed', error: '任务创建失败，请稍后重试' }));
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'failed', error: err?.message || '重新生成失败' }));
    } finally {
      setRegenerating(false);
    }
  }, [data?.skillName, data?.skill]);

  const { status, progress, message, result, error } = state;
  const skillLabel = data?.skillName || data?.skill || '教学视频';
  const videoSrc = getVideoSrc(result);
  const notRendered = status === 'completed' && (!videoSrc || result?.render_status === 'not_rendered');

  return (
    <div className="col" style={{ gap: 8, width: '100%', maxWidth: 460 }}>
      <div className="row" style={{ gap: 8 }}>
        <Film size={15} style={{ color: 'var(--brand-600)' }} />
        <span className="small" style={{ fontWeight: 700 }}>{skillLabel}</span>
        {status === 'completed' && <Tag tone="green" icon={<CheckCircle2 size={11} />}>完成</Tag>}
        {status === 'failed' && <Tag tone="rose" icon={<AlertCircle size={11} />}>失败</Tag>}
        {status === 'expired' && <Tag tone="neutral" icon={<Clock3 size={11} />}>过期</Tag>}
      </div>

      {status !== 'completed' && status !== 'failed' && status !== 'expired' && (
        <div className="col" style={{ gap: 8, padding: '14px 16px', border: '1px dashed var(--border)', borderRadius: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            {regenerating ? (
              <Loader2 size={14} className="btn__spinner" style={{ color: 'var(--brand-600)', borderWidth: 2 }} />
            ) : (
              <Loader2 size={14} className="btn__spinner" style={{ color: 'var(--brand-600)', borderWidth: 2 }} />
            )}
            <span className="small" style={{ fontWeight: 600 }}>{STAGE_LABELS[status] || message || '生成中…'}</span>
          </div>
          <Bar value={progress} flowing />
          <span className="tiny faint">{progress}% · 视频含 TTS 与画面渲染，预计 2-4 分钟，可离开本页，完成后到资源库查看</span>
        </div>
      )}

      {status === 'completed' && notRendered && (
        <div className="col" style={{ gap: 6, padding: '12px 14px', border: '1px dashed var(--border)', borderRadius: 10 }}>
          <span className="small" style={{ fontWeight: 600, color: 'var(--amber-600)' }}>视频未实际渲染</span>
          <p className="tiny muted" style={{ lineHeight: 1.6, margin: 0 }}>
            {result?.render_error || '已生成脚本与音频，但缺少视频文件（渲染环境未就绪）。可尝试重新生成。'}
          </p>
          <div>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleRegenerate} disabled={regenerating}>
              <RotateCcw size={13} />
              重新生成
            </button>
          </div>
        </div>
      )}

      {status === 'completed' && !notRendered && videoSrc && (
        <div className="col" style={{ gap: 6 }}>
          <video src={videoSrc} controls style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block', background: '#000' }} />
          <span className="tiny faint">
            {result?.duration_sec ? `时长 ${Math.round(result.duration_sec)}s` : ''}
            {result?.segments_count ? ` · ${result.segments_count} 个片段` : ''}
            {result?.tts_status === 'silent' ? ' · 无声版（配音合成失败，可重新生成）' : ''}
          </span>
        </div>
      )}

      {status === 'failed' && (
        <div className="col" style={{ gap: 6, padding: '12px 14px', border: '1px dashed var(--border)', borderRadius: 10 }}>
          <span className="small" style={{ fontWeight: 600, color: 'var(--rose-600)' }}>视频生成失败</span>
          <p className="tiny muted" style={{ lineHeight: 1.6, margin: 0 }}>{error || message || '请稍后重试'}</p>
          <div>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleRegenerate} disabled={regenerating}>
              <RotateCcw size={13} />
              重新生成
            </button>
          </div>
        </div>
      )}

      {status === 'expired' && (
        <div className="col" style={{ gap: 6, padding: '12px 14px', border: '1px dashed var(--border)', borderRadius: 10 }}>
          <span className="small" style={{ fontWeight: 600 }}>任务已过期</span>
          <p className="tiny muted" style={{ lineHeight: 1.6, margin: 0 }}>{message || '任务已过期或服务已重启，请重新生成'}</p>
          <div>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleRegenerate} disabled={regenerating}>
              <RotateCcw size={13} />
              重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ tone, icon, children }: { tone: 'green' | 'rose' | 'neutral'; icon: React.ReactNode; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: 'var(--green-600)',
    rose: 'var(--rose-600)',
    neutral: 'var(--text-faint)',
  };
  return (
    <span className="row tiny" style={{ gap: 4, color: colors[tone], fontWeight: 600, alignItems: 'center' }}>
      {icon}
      {children}
    </span>
  );
}
