import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, BulletPointsVisual } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
  /** 本段总帧数，用于把要点浮现均匀铺满整段（与解说词节奏对齐） */
  durationFrames?: number;
}

/**
 * 要点列表组件
 *
 * 每条要点依次从右侧滑入 + 淡入
 * 高亮项有强调动画（脉冲缩放 + 颜色变化）
 *
 * 浮现节奏：把所有要点均匀分布在整段时长内，使旁白讲到第 N 条时第 N 条恰好出现，
 * 而不是固定 12 帧内全部弹完后旁白还在念。
 */
export const BulletPoints: React.FC<Props> = ({ segment, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visual = segment.visual as BulletPointsVisual;

  if (visual.type !== 'bullets') return null;

  const count = Math.max(1, visual.items.length);
  // 预留段首/段尾余量：首条出现后留 8% 起播缓冲，末条在 ~85% 处出齐，剩下时间收尾。
  const leadIn = Math.round((durationFrames ?? count * VIDEO_THEME.timing.bulletStagger) * 0.08);
  const span = Math.max(
    0,
    Math.round((durationFrames ?? count * VIDEO_THEME.timing.bulletStagger) * 0.85) - leadIn,
  );
  const staggerFrames = count > 1 ? span / (count - 1) : 0;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 120px',
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      {/* 段落标题 */}
      {segment.emphasis[0] && (
        <h2
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: VIDEO_THEME.text.accent,
            fontFamily: VIDEO_THEME.fonts.heading,
            marginBottom: 48,
            opacity: interpolate(
              spring({ frame, fps, config: { damping: 12 } }),
              [0, 1],
              [0, 1]
            ),
          }}
        >
          {segment.emphasis[0]}
        </h2>
      )}

      {/* 要点列表 */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visual.items.map((item, i) => {
          const delay = i * staggerFrames;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 80 },
          });

          const opacity = interpolate(progress, [0, 1], [0, 1]);
          const translateX = interpolate(progress, [0, 1], [60, 0]);

          // 高亮判断
          const isHighlighted =
            visual.highlight_index === i ||
            (visual.highlight_index === -1 &&
              segment.emphasis.some(kw => item.includes(kw)));

          // 高亮脉冲动画
          const pulseFrame = frame - delay - 10;
          const pulseProgress = spring({
            frame: pulseFrame,
            fps,
            config: { damping: 8, stiffness: 120 },
          });
          const scale = isHighlighted
            ? interpolate(pulseProgress, [0, 0.5, 1], [1, 1.08, 1])
            : 1;

          return (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 28,
                opacity,
                transform: `translateX(${translateX}px) scale(${scale})`,
              }}
            >
              {/* 圆点标记 */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: isHighlighted
                    ? VIDEO_THEME.text.accent
                    : VIDEO_THEME.text.secondary,
                  marginRight: 24,
                  flexShrink: 0,
                  boxShadow: isHighlighted
                    ? `0 0 20px ${VIDEO_THEME.text.accent}80`
                    : 'none',
                }}
              />

              {/* 文字 */}
              <span
                style={{
                  fontSize: 44,
                  fontWeight: isHighlighted ? 700 : 400,
                  color: isHighlighted
                    ? VIDEO_THEME.text.primary
                    : VIDEO_THEME.text.secondary,
                  fontFamily: VIDEO_THEME.fonts.body,
                }}
              >
                {item}
              </span>
            </li>
          );
        })}
      </ul>
    </AbsoluteFill>
  );
};
