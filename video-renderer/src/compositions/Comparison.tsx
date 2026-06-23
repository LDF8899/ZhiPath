import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, ComparisonVisual } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
}

/**
 * 对比布局组件
 *
 * 左右两栏对比，各自依次浮现
 */
export const Comparison: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visual = segment.visual as ComparisonVisual;

  if (visual.type !== 'comparison') return null;

  const headerProgress = spring({ frame, fps, config: { damping: 12 } });
  const staggerFrames = VIDEO_THEME.timing.bulletStagger;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 100px',
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      <div style={{ display: 'flex', gap: 60, flex: 1 }}>
        {/* 左栏 */}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#F87171',
              fontFamily: VIDEO_THEME.fonts.heading,
              marginBottom: 32,
              opacity: interpolate(headerProgress, [0, 1], [0, 1]),
            }}
          >
            {visual.left_title}
          </h3>

          {visual.left_items.map((item, i) => {
            const progress = spring({
              frame: frame - 10 - i * staggerFrames,
              fps,
              config: { damping: 12, stiffness: 80 },
            });

            return (
              <div
                key={i}
                style={{
                  fontSize: 36,
                  color: VIDEO_THEME.text.secondary,
                  fontFamily: VIDEO_THEME.fonts.body,
                  marginBottom: 20,
                  padding: '12px 20px',
                  background: '#1E1B2E30',
                  borderRadius: 8,
                  borderLeft: '4px solid #F87171',
                  opacity: interpolate(progress, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(progress, [0, 1], [30, 0])}px)`,
                }}
              >
                {item}
              </div>
            );
          })}
        </div>

        {/* 分割线 */}
        <div
          style={{
            width: 3,
            background: `linear-gradient(180deg, transparent, ${VIDEO_THEME.text.accent}, transparent)`,
            opacity: interpolate(headerProgress, [0, 1], [0, 0.5]),
          }}
        />

        {/* 右栏 */}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#34D399',
              fontFamily: VIDEO_THEME.fonts.heading,
              marginBottom: 32,
              opacity: interpolate(headerProgress, [0, 1], [0, 1]),
            }}
          >
            {visual.right_title}
          </h3>

          {visual.right_items.map((item, i) => {
            const progress = spring({
              frame: frame - 10 - i * staggerFrames,
              fps,
              config: { damping: 12, stiffness: 80 },
            });

            return (
              <div
                key={i}
                style={{
                  fontSize: 36,
                  color: VIDEO_THEME.text.secondary,
                  fontFamily: VIDEO_THEME.fonts.body,
                  marginBottom: 20,
                  padding: '12px 20px',
                  background: '#1E2E1B30',
                  borderRadius: 8,
                  borderLeft: '4px solid #34D399',
                  opacity: interpolate(progress, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
