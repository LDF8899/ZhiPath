import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
}

/**
 * 标题卡片组件
 *
 * 大标题 + 副标题，从下方滑入 + 淡入
 */
export const TitleCard: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visual = segment.visual;

  if (visual.type !== 'title') return null;

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const subtitleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);

  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: visual.background === 'gradient_blue'
          ? 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)'
          : VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      <h1
        style={{
          fontSize: 96,
          fontWeight: 700,
          color: VIDEO_THEME.text.primary,
          fontFamily: VIDEO_THEME.fonts.heading,
          textAlign: 'center',
          margin: 0,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        {visual.title}
      </h1>

      {visual.subtitle && (
        <p
          style={{
            fontSize: 40,
            color: VIDEO_THEME.text.secondary,
            fontFamily: VIDEO_THEME.fonts.body,
            textAlign: 'center',
            margin: 0,
            marginTop: 24,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          {visual.subtitle}
        </p>
      )}

      {/* 底部装饰线 */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          width: interpolate(titleProgress, [0, 1], [0, 400]),
          height: 4,
          background: `linear-gradient(90deg, transparent, ${VIDEO_THEME.text.accent}, transparent)`,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};
