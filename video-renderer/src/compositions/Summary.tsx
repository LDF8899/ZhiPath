import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, SummaryVisual } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
}

/**
 * 总结收束组件
 *
 * 关键点逐条浮现，带序号标记
 */
export const Summary: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visual = segment.visual as SummaryVisual;

  if (visual.type !== 'key_points') return null;

  const titleProgress = spring({ frame, fps, config: { damping: 12 } });
  const staggerFrames = VIDEO_THEME.timing.bulletStagger;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 120px',
        background: `linear-gradient(135deg, ${VIDEO_THEME.canvas.backgroundColor} 0%, #1E1B4B 100%)`,
      }}
    >
      {/* 标题 */}
      <h2
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: VIDEO_THEME.text.accent,
          fontFamily: VIDEO_THEME.fonts.heading,
          marginBottom: 48,
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        要点总结
      </h2>

      {/* 关键点列表 */}
      {visual.points.map((point, i) => {
        const progress = spring({
          frame: frame - 15 - i * staggerFrames,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const translateX = interpolate(progress, [0, 1], [50, 0]);

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 28,
              opacity,
              transform: `translateX(${translateX}px)`,
            }}
          >
            {/* 序号 */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${VIDEO_THEME.text.accent}, #6366F1)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 24,
                flexShrink: 0,
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
                fontFamily: VIDEO_THEME.fonts.heading,
              }}
            >
              {i + 1}
            </div>

            {/* 文字 */}
            <span
              style={{
                fontSize: 42,
                color: VIDEO_THEME.text.primary,
                fontFamily: VIDEO_THEME.fonts.body,
                fontWeight: 500,
              }}
            >
              {point}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
