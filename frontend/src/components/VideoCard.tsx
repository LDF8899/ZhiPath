import { useState, useEffect, useRef, useCallback } from 'react';
import { IconFilm, IconCheck, IconWarning, IconClock } from './icons';
import { getVideoTaskStatus, createVideoTask } from '../api/user';

interface Props {
  data: {
    // video_pending fields
    taskId?: string;
    skillName?: string;
    difficulty?: string;
    // video completed fields
    skill?: string;
    title?: string;
    video_file_path?: string;
    url?: string;
    poster?: string;
    duration_sec?: number;
    segments_count?: number;
    // common
    status?: string;
    message?: string;
    text?: string;
    script?: string;
  };
}

/** 进度阶段文案 */
const STAGE_LABELS: Record<string, string> = {
  pending: '准备中...',
  script: '正在生成视频脚本',
  tts: '正在合成配音',
  render: '正在渲染视频画面',
  compose: '正在合成成片',
  completed: '生成完成',
  failed: '生成失败',
  expired: '任务已过期',
};

/**
 * 教学视频卡片 — 支持进度轮询
 * status: pending(轮询中) / completed(播放器) / failed
 */
export default function VideoCard({ data }: Props) {
  const [taskState, setTaskState] = useState({
    status: data?.status || 'pending',
    progress: 0,
    message: data?.message || '',
    result: null as any,
    error: '',
    elapsedSec: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(Date.now());
  const [activeTaskId, setActiveTaskId] = useState(data?.taskId || '');

  // 重新生成：直接调 API 获取新 taskId，重新开始轮询
  const handleRegenerate = useCallback(async () => {
    const skill = data?.skillName || data?.skill || '';
    if (!skill) return;
    try {
      setTaskState({
        status: 'pending',
        progress: 0,
        message: '正在重新生成...',
        result: null,
        error: '',
        elapsedSec: 0,
      });
      startTimeRef.current = Date.now();
      const res = await createVideoTask({ skillName: skill, difficulty: data?.difficulty });
      if (res?.data?.taskId) {
        setActiveTaskId(res.data.taskId);
      }
    } catch (e: any) {
      setTaskState((prev) => ({
        ...prev,
        status: 'failed',
        error: e?.message || '重新生成失败',
      }));
    }
  }, [data?.skillName, data?.skill, data?.difficulty]);

  // 轮询任务进度
  useEffect(() => {
    if (!activeTaskId || data?.status === 'completed' || data?.status === 'failed') return;

    let notFoundCount = 0;

    const poll = async () => {
      try {
        const res = await getVideoTaskStatus(activeTaskId);
        if (res?.data) {
          notFoundCount = 0;
          const d = res.data;
          setTaskState({
            status: d.status,
            progress: d.progress || 0,
            message: d.message || '',
            result: d.result,
            error: d.error || '',
            elapsedSec: d.elapsedSec || Math.round((Date.now() - startTimeRef.current) / 1000),
          });
          // 完成或失败时停止轮询
          if (d.status === 'completed' || d.status === 'failed') {
            clearInterval(timerRef.current);
          }
        } else {
          // 后端返回 null — 任务不存在或已过期
          notFoundCount++;
          if (notFoundCount >= 2) {
            // 连续 2 次未找到，判定为过期（避免单次网络抖动误判）
            setTaskState((prev) => ({
              ...prev,
              status: 'expired',
              message: '任务已过期或服务器已重启，请重新生成',
            }));
            clearInterval(timerRef.current);
          }
        }
      } catch {
        // 网络错误不中断轮询
      }
    };

    // 立即查一次，然后每 3 秒轮询
    poll();
    timerRef.current = setInterval(poll, 3000);

    return () => clearInterval(timerRef.current);
  }, [activeTaskId, data?.status]);

  const { status, progress, message, result, error, elapsedSec } = taskState;
  const skillLabel = data?.skillName || data?.skill || '教学视频';
  const isTerminal = status === 'completed' || status === 'failed';

  return (
    <div className="hd-card" style={{ padding: 14, minWidth: 320, maxWidth: 440 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <IconFilm size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{skillLabel}</span>
        {isTerminal && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            color: status === 'completed' ? 'var(--note-green)' : status === 'expired' ? 'var(--pencil)' : 'var(--accent)',
            border: `1px solid ${status === 'completed' ? 'var(--note-green)' : status === 'expired' ? 'var(--rule)' : 'var(--accent)'}`,
            borderRadius: 4,
            padding: '1px 6px',
          }}>
            {status === 'completed' ? '✓ 完成' : status === 'expired' ? '⏰ 过期' : '✗ 失败'}
          </span>
        )}
      </div>

      {/* ── 进度中 ── */}
      {status !== 'completed' && status !== 'failed' && status !== 'expired' && (
        <div style={{
          border: '2px dashed var(--rule)',
          borderRadius: 8,
          padding: '20px 16px',
          background: 'var(--paper-tint)',
        }}>
          {/* 旋转图标 + 阶段文案 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="24" height="24" viewBox="0 0 48 48" className="chat-spin">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="3" strokeDasharray="6 4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="30 96" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 14 }}>
                {STAGE_LABELS[status] || message || '生成中...'}
              </div>
              {message && STAGE_LABELS[status] && STAGE_LABELS[status] !== message && (
                <div style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--pencil)', marginTop: 2 }}>
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* 进度条 */}
          <div className="hd-progress" style={{ marginBottom: 8 }}>
            <div
              className="hd-progress-bar"
              style={{
                width: `${progress}%`,
                transition: 'width 0.5s ease',
                background: 'var(--accent)',
              }}
            />
          </div>

          {/* 底部信息 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pencil)' }}>
              {progress}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pencil)' }}>
              <IconClock size={12} />
              {elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`}
            </span>
          </div>
        </div>
      )}

      {/* ── 完成 ── */}
      {status === 'completed' && result && (
        <div>
          <video
            src={`/api/video/${result.video_file_path?.split('/').pop() || result.video_file_path?.split('\\').pop() || ''}`}
            controls
            style={{
              width: '100%',
              borderRadius: 8,
              border: '2px solid var(--pencil)',
              display: 'block',
              background: '#000',
            }}
          />
          <div style={{
            display: 'flex',
            gap: 16,
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--pencil)',
          }}>
            {result.duration_sec && <span>时长 {Math.round(result.duration_sec)}s</span>}
            {result.segments_count && <span>{result.segments_count} 个片段</span>}
            {elapsedSec > 0 && <span>耗时 {elapsedSec}s</span>}
          </div>
        </div>
      )}

      {/* ── 失败 ── */}
      {status === 'failed' && (
        <div style={{
          border: '2px dashed var(--rule)',
          borderRadius: 8,
          padding: 16,
          background: 'var(--note-yellow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <IconWarning size={16} style={{ color: '#8a6d00' }} />
            <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 14, color: '#8a6d00' }}>
              视频生成失败
            </span>
          </div>
          <p style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>
            {error || message || '请稍后重试'}
          </p>
        </div>
      )}

      {/* ── 过期 ── */}
      {status === 'expired' && (
        <div style={{
          border: '2px dashed var(--rule)',
          borderRadius: 8,
          padding: 16,
          background: 'var(--paper-tint)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <IconClock size={16} style={{ color: 'var(--pencil)' }} />
            <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 14, color: 'var(--ink)' }}>
              任务已过期
            </span>
          </div>
          <p style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--pencil)', margin: 0, lineHeight: 1.6, marginBottom: 10 }}>
            {message || '任务已过期或服务器已重启，请重新发送指令生成视频'}
          </p>
          <button
            onClick={handleRegenerate}
            style={{
              width: '100%',
              padding: '8px 0',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--accent)',
              fontFamily: 'var(--hand-bold)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            🔄 重新生成
          </button>
        </div>
      )}
    </div>
  );
}
