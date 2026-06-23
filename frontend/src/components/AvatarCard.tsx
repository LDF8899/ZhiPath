import { useEffect, useRef, useState, useCallback } from 'react';
import { IconRobot, IconWarning } from './icons';
import { closeAvatarSession } from '../api/user';

interface Props {
  data: {
    skill: string;
    title: string;
    status?: string;
    url?: string;
    streamUrl?: string;
    sessionId?: string;
    rtcToken?: string;
    roomId?: string;
    poster?: string;
    text?: string;
    script?: string;
    provider?: string;
    avatarId?: string;
    app_id?: string;
  };
}

declare global {
  interface Window {
    Interactive?: {
      RTCPlayer: new () => RTCPlayerInstance;
    };
  }
}

interface RTCPlayerInstance {
  playerType: number;
  stream: { sid: string; streamUrl: string };
  videoSize: { width: number; height: number };
  container: HTMLElement | null;
  play: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  destroy?: () => void;
}

/**
 * 数字人讲解卡片 — 讯飞 RTCPlayer 虚拟人
 *
 * status: ready + streamUrl → 初始化 RTCPlayer 播放 WebRTC 流
 * status: ready（无 streamUrl） → 降级展示讲解词
 * status: not_configured → 未配置占位
 * status: error → 错误占位
 */
export default function AvatarCard({ data }: Props) {
  const status = data?.status || 'ready';
  const configured = status === 'ready';
  const hasStream = configured && !!data?.streamUrl;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RTCPlayerInstance | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 动态加载 RTCPlayer SDK ──────────────────────────────
  useEffect(() => {
    if (window.Interactive?.RTCPlayer) {
      setSdkLoaded(true);
      return;
    }
    const existing = document.querySelector('script[src="/sdk/rtcplayer.iife.js"]');
    if (existing) {
      existing.addEventListener('load', () => setSdkLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = '/sdk/rtcplayer.iife.js';
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => setError('RTCPlayer SDK 加载失败');
    document.head.appendChild(script);
  }, []);

  // ── 初始化播放器 ────────────────────────────────────────
  const initPlayer = useCallback(async () => {
    if (!sdkLoaded || !hasStream || !containerRef.current || !window.Interactive?.RTCPlayer) return;
    if (playerRef.current) return; // 已初始化

    try {
      const player = new window.Interactive.RTCPlayer();
      player.playerType = 6; // WebRTC
      player.stream = {
        sid: `sid_${data.skill}_${Date.now()}`,
        streamUrl: data.streamUrl!,
      };
      player.videoSize = { width: 720, height: 1280 };
      player.container = containerRef.current;
      await player.play();
      playerRef.current = player;
      setPlaying(true);
    } catch (e: any) {
      setError(`播放器初始化失败：${e.message}`);
    }
  }, [sdkLoaded, hasStream, data.streamUrl, data.skill]);

  // ── 自动播放 ────────────────────────────────────────────
  useEffect(() => {
    if (hasStream && sdkLoaded) {
      initPlayer();
    }
    return () => {
      // 组件卸载时停止播放 + 关闭会话
      if (playerRef.current) {
        try { playerRef.current.stop?.(); } catch {}
        try { playerRef.current.destroy?.(); } catch {}
        playerRef.current = null;
      }
      if (data.sessionId) {
        closeAvatarSession(data.sessionId).catch(() => {});
      }
    };
  }, [hasStream, sdkLoaded]);

  // ── 渲染 ────────────────────────────────────────────────
  return (
    <div className="hd-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <IconRobot size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>
          {data.title || `${data.skill} 数字人讲解`}
        </span>
      </div>

      <div
        style={{
          border: configured ? '2px solid var(--pencil)' : '2px dashed var(--rule)',
          borderRadius: 8,
          padding: hasStream ? 0 : '28px 16px',
          textAlign: 'center',
          background: configured ? '#eef2fb' : 'var(--note-yellow)',
          overflow: 'hidden',
        }}
      >
        {hasStream ? (
          <>
            {/* RTCPlayer 视频容器 */}
            <div
              ref={containerRef}
              style={{
                width: '100%',
                aspectRatio: '9/16',
                maxHeight: 400,
                margin: '0 auto',
                background: '#000',
                position: 'relative',
              }}
            />
            {error && (
              <div style={{ padding: '8px 12px', color: '#c00', fontFamily: 'var(--hand)', fontSize: 13 }}>
                {error}
              </div>
            )}
            {!playing && !error && (
              <div style={{ padding: '12px', color: 'var(--pencil)', fontFamily: 'var(--hand)', fontSize: 13 }}>
                正在连接数字人...
              </div>
            )}
          </>
        ) : configured ? (
          <>
            {/* 无 streamUrl 的降级展示 */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto' }}>
              <circle cx="32" cy="22" r="12" stroke="var(--accent)" strokeWidth="2.5" fill="#fff" />
              <circle cx="27" cy="21" r="2" fill="var(--ink)" />
              <circle cx="37" cy="21" r="2" fill="var(--ink)" />
              <path d="M27 27 Q32 31 37 27" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M16 52 Q16 38 32 38 Q48 38 48 52" stroke="var(--accent)" strokeWidth="2.5" fill="#fff" />
            </svg>
            <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 14, marginTop: 8, color: 'var(--ink)' }}>
              虚拟教师已就绪（讯飞 RTCPlayer）
            </div>
            <div style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--pencil)', marginTop: 4 }}>
              点击下方讲解词即可由数字人朗读
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
              <IconWarning size={16} style={{ color: '#8a6d00' }} />
              <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 14, color: '#8a6d00' }}>
                数字人功能未配置
              </span>
            </div>
            {data.text && (
              <p style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                {data.text}
              </p>
            )}
          </>
        )}
      </div>

      {/* 讲解词 */}
      {data.script && (
        <div className="hd-dashed" style={{ marginTop: 10 }}>
          <div style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.06em' }}>
            讲解词
          </div>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
            {data.script}
          </div>
        </div>
      )}
    </div>
  );
}
