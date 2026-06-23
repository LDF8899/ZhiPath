import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, HighlightReelVisual } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
}

/**
 * 关键词大字组件
 *
 * 关键词依次居中放大显示，强调效果
 */
export const HighlightReel: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const visual = segment.visual as HighlightReelVisual;

  if (visual.type !== 'keywords') return null;

  const { keywords } = visual;
  const framesPerKeyword = Math.floor(durationInFrames / keywords.length);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      {keywords.map((keyword, i) => {
        const startFrame = i * framesPerKeyword;
        const endFrame = (i + 1) * framesPerKeyword;

        // 进入动画
        const enterProgress = spring({
          frame: frame - startFrame,
          fps,
          config: { damping: 10, stiffness: 80 },
        });

        // 退出动画
        const exitProgress = spring({
          frame: frame - endFrame + 10,
          fps,
          config: { damping: 15, stiffness: 60 },
        });

        const isActive = frame >= startFrame && frame < endFrame;
        if (!isActive) return null;

        const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
        const scale = interpolate(enterProgress, [0, 1], [0.3, 1]);
        const exitOpacity = frame > endFrame - 15
          ? interpolate(exitProgress, [0, 1], [1, 0])
          : 1;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: opacity * exitOpacity,
              transform: `scale(${scale})`,
            }}
          >
            <span
              style={{
                fontSize: 100,
                fontWeight: 800,
                color: VIDEO_THEME.text.accent,
                fontFamily: VIDEO_THEME.fonts.heading,
                textShadow: `0 0 40px ${VIDEO_THEME.text.accent}60`,
                letterSpacing: 4,
              }}
            >
              {keyword}
            </span>

            {/* 底部装饰 */}
            <div
              style={{
                width: interpolate(enterProgress, [0, 1], [0, 300]),
                height: 4,
                background: VIDEO_THEME.text.accent,
                marginTop: 20,
                borderRadius: 2,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
