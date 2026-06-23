import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segments: VideoSegment[];
  segmentFrames: Array<{ startFrame: number; durationFrames: number }>;
  fps: number;
}

/**
 * 字幕叠加层
 *
 * 在视频底部显示当前 segment 的 narration 文字
 * 逐字显示效果，与 TTS 音频同步
 */
export const SubtitleOverlay: React.FC<Props> = ({
  segments,
  segmentFrames,
  fps,
}) => {
  const frame = useCurrentFrame();

  // 找到当前活跃的 segment
  let activeIndex = -1;
  for (let i = 0; i < segmentFrames.length; i++) {
    const sf = segmentFrames[i];
    if (frame >= sf.startFrame && frame < sf.startFrame + sf.durationFrames) {
      activeIndex = i;
      break;
    }
  }

  if (activeIndex < 0) return null;

  const segment = segments[activeIndex];
  const sf = segmentFrames[activeIndex];
  const localFrame = frame - sf.startFrame;
  const narration = segment.narration;

  // 逐字显示：按 TTS 语速计算应该显示多少字
  const durationSec = sf.durationFrames / fps;
  const charsPerFrame = narration.length / sf.durationFrames;
  const charsToShow = Math.min(
    narration.length,
    Math.floor(localFrame * charsPerFrame) + 1,
  );

  const displayText = narration.slice(0, charsToShow);

  // 淡入淡出
  const fadeIn = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(
    localFrame,
    [sf.durationFrames - 10, sf.durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '75%',
          padding: '14px 28px',
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 10,
          opacity,
        }}
      >
        <span
          style={{
            fontSize: 36,
            color: VIDEO_THEME.text.primary,
            fontFamily: VIDEO_THEME.fonts.body,
            lineHeight: 1.5,
            letterSpacing: 1,
          }}
        >
          {displayText}
          {charsToShow < narration.length && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: '0.8em',
                backgroundColor: VIDEO_THEME.text.accent,
                marginLeft: 2,
                verticalAlign: 'middle',
              }}
            />
          )}
        </span>
      </div>
    </AbsoluteFill>
  );
};
