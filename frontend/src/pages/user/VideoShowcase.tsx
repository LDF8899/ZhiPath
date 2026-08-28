import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createVideoTask, getVideoTaskStatus } from '../../api/user';
import '../../styles/hand-draw.css';

const VOICES: Array<{ id: string; label: string }> = [
  { id: 'zh-CN-YunyangNeural', label: '专业男声' },
  { id: 'zh-CN-XiaoxiaoNeural', label: '自然女声' },
  { id: 'zh-CN-YunxiNeural', label: '年轻男声' },
  { id: 'zh-CN-XiaoyiNeural', label: '清亮女声' },
  { id: 'zh-CN-YunjianNeural', label: '纪录片男声' },
];

const VISUAL_STYLES: Array<{ id: string; label: string }> = [
  { id: 'auto', label: '自动（按主题推断）' },
  { id: 'editorial-paper', label: '纸面手绘（默认）' },
  { id: 'precision-mono', label: '极简单色' },
  { id: 'terminal-grid', label: '终端网格' },
  { id: 'cinematic-product', label: '电影感产品' },
];

const DURATIONS: Array<{ value: number; label: string }> = [
  { value: 60, label: '1 分钟' },
  { value: 120, label: '2 分钟' },
  { value: 180, label: '3 分钟' },
  { value: 300, label: '5 分钟' },
  { value: 480, label: '8 分钟' },
  { value: 600, label: '10 分钟' },
];

const STAGE_LABELS: Record<string, string> = {
  pending: '排队中',
  script: '生成分镜',
  tts: '合成配音',
  render: '渲染画面',
  compose: '拼接成片',
  completed: '已完成',
  failed: '失败',
};

interface TaskState {
  status: string;
  progress: number;
  message: string;
  result?: {
    video_file_path?: string;
    audio_file_path?: string;
    duration_sec?: number;
    segments_count?: number;
    skill_name?: string;
    showcase?: boolean;
  };
  error?: string;
  elapsedSec?: number;
}

export default function VideoShowcase() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState('');
  const [projectName, setProjectName] = useState('智途 ZhiPath 项目介绍');
  const [duration, setDuration] = useState(300);
  const [voice, setVoice] = useState('zh-CN-YunyangNeural');
  const [visualStyle, setVisualStyle] = useState('auto');

  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState<TaskState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 轮询任务状态
  useEffect(() => {
    if (!taskId) return;
    setBusy(false);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getVideoTaskStatus(taskId);
        const data = res?.data;
        if (data) {
          setTask(data);
          if (['completed', 'failed'].includes(data.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false);
          }
        }
      } catch {
        // 忽略单次轮询失败
      }
    }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [taskId]);

  const generate = async () => {
    setBusy(true);
    setTask(null);
    setTaskId('');
    try {
      const res = await createVideoTask({
        prompt: prompt.trim() || projectName.trim(),
        assets: assets.trim() || undefined,
        projectName: projectName.trim() || '智途 ZhiPath 项目介绍',
        targetDurationSec: duration,
        voice,
        visualStyle,
        llmProvider: 'deepseek',
        skillName: projectName.trim() || 'ZhiPath 项目介绍',
      });
      const data = res?.data?.data || res?.data;
      const id = data?.taskId || data?.externalId;
      if (!id) throw new Error('未获取到任务 ID');
      setTaskId(id);
      setTask({ status: 'pending', progress: 0, message: '任务已提交，准备启动...' });
    } catch (e: any) {
      setBusy(false);
      setTask({ status: 'failed', progress: 0, message: `启动失败：${e?.message || '未知错误'}`, error: e?.message });
    }
  };

  const videoUrl = task?.result?.video_file_path
    ? `/api/video/${(task.result.video_file_path as string).replace(/\\/g, '/').split('/').pop()}`
    : '';

  const pct = Math.max(0, Math.min(100, Math.round(task?.progress || 0)));
  const stageLabel = STAGE_LABELS[task?.status || ''] || (task?.status || '');

  return (
    <div className="hd-page"><div className="hd-page-wrap" style={{ maxWidth: 1000 }}>
      <div className="hd-header">
        <div>
          <h1>素材演示视频</h1>
          <p style={{ color: 'var(--pencil)' }}>输入主题 + 素材图片文件夹，自动生成带解说、字幕、画面动效的宣传演示视频（LLM 分镜 + Edge 配音 + Remotion 渲染）。</p>
        </div>
      </div>

      <section className="hd-card-accent" style={{ marginTop: 20 }}>
        <div className="hd-flex-col" style={{ gap: 14 }}>
          <label className="hd-field-label">视频需求</label>
          <textarea
            className="hd-input"
            style={{ minHeight: 88, resize: 'vertical', fontFamily: 'inherit' }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例：生成一份 5 分钟智途 ZhiPath 项目介绍视频，重点展示实机页面和核心流程，风格正式但不要像 PPT"
          />

          <div className="hd-flex" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="hd-field-label">素材文件夹（含 png/jpg/jpeg/webp）</label>
              <input className="hd-input" value={assets} onChange={(e) => setAssets(e.target.value)} placeholder="例：D:\素材\智途界面截图（留空则用纯文字分镜）" />
              <div style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 6 }}>留空时不使用素材，仅按需求生成文字分镜演示视频。</div>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="hd-field-label">项目名</label>
              <input className="hd-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
          </div>

          <div className="hd-flex" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label className="hd-field-label">目标时长</label>
              <select className="hd-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="hd-field-label">配音</label>
              <select className="hd-input" value={voice} onChange={(e) => setVoice(e.target.value)}>
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="hd-field-label">视觉风格</label>
              <select className="hd-input" value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)}>
                {VISUAL_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="hd-flex" style={{ gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="hd-btn" onClick={generate} disabled={busy || (!!task && !['completed', 'failed'].includes(task.status))}>
              {busy ? '提交中...' : '生成素材视频'}
            </button>
            <button className="hd-btn secondary small" onClick={() => navigate('/user/chat')}>去 AI 导师</button>
            <span style={{ fontSize: 12, color: 'var(--pencil)' }}>生成通常需 3-6 分钟，依赖本机 Chrome / ffmpeg / edge-tts。</span>
          </div>
        </div>
      </section>

      {task && (
        <section className="hd-card" style={{ marginTop: 20 }}>
          {task.status === 'failed' ? (
            <div className="hd-note" style={{ color: 'var(--accent)' }}>
              生成失败：{task.error || task.message || '未知错误'}
            </div>
          ) : (
            <>
              <div className="hd-flex" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ font: '700 13px/1 var(--mono)', letterSpacing: '0.06em' }}>{stageLabel}</span>
                <span style={{ color: 'var(--pencil)', fontSize: 13 }}>{task.message || '处理中...'}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--pencil)', fontSize: 12 }}>
                  {pct}%{task.elapsedSec != null ? ` · ${Math.round(task.elapsedSec)}s` : ''}
                </span>
              </div>
              <div style={{ marginTop: 12, height: 14, border: '2px solid var(--ink)', borderRadius: 999, background: 'var(--paper)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width .4s ease' }} />
              </div>
            </>
          )}

          {task.status === 'completed' && videoUrl && (
            <div style={{ marginTop: 18 }}>
              <video src={videoUrl} controls style={{ width: '100%', maxHeight: 460, borderRadius: 12, border: '3px solid var(--ink)', background: '#000' }} />
              <div className="hd-flex" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {task.result?.duration_sec != null && <span className="hd-chip">时长 {task.result.duration_sec}s</span>}
                {task.result?.segments_count != null && <span className="hd-chip">{task.result.segments_count} 个分镜</span>}
                {task.result?.skill_name && <span className="hd-chip">{task.result.skill_name}</span>}
                <span style={{ fontSize: 12, color: 'var(--pencil)' }}>若无法播放，请确认后端已运行且在 D:/tmp/zhipath/video 下有输出。</span>
              </div>
            </div>
          )}
        </section>
      )}
    </div></div>
  );
}
