import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, CodeWalkthroughVisual } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
}

/**
 * 代码走读组件
 *
 * 代码逐字显示（打字机效果）+ 指定行高亮
 */
export const CodeWalkthrough: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const visual = segment.visual as CodeWalkthroughVisual;

  if (visual.type !== 'code') return null;

  const { code, language, highlight_lines = [], typing_effect = true } = visual;

  // 打字机效果：逐字显示
  const totalChars = code.length;
  const charsToShow = typing_effect
    ? Math.floor(
        interpolate(frame, [0, durationInFrames * 0.7], [0, totalChars], {
          extrapolateRight: 'clamp',
        }),
      )
    : totalChars;

  const displayCode = code.slice(0, charsToShow);
  const lines = displayCode.split('\n');

  // 标题淡入
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 100px',
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      {/* 语言标签 */}
      <div
        style={{
          fontSize: 28,
          color: VIDEO_THEME.text.accent,
          fontFamily: VIDEO_THEME.fonts.code,
          marginBottom: 20,
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {language}
      </div>

      {/* 代码块 */}
      <div
        style={{
          background: VIDEO_THEME.codeBlock.background,
          border: `1px solid ${VIDEO_THEME.codeBlock.border}`,
          borderRadius: 12,
          padding: '32px 40px',
          fontFamily: VIDEO_THEME.fonts.code,
          fontSize: 36,
          lineHeight: 1.6,
          overflow: 'hidden',
        }}
      >
        {lines.map((line, i) => {
          const isHighlighted = highlight_lines.includes(i + 1);

          // 高亮行淡入
          const lineProgress = spring({
            frame: frame - Math.max(0, (i - 1) * 3),
            fps,
            config: { damping: 12 },
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                background: isHighlighted
                  ? VIDEO_THEME.codeBlock.highlightBackground
                  : 'transparent',
                borderRadius: 4,
                padding: '2px 8px',
                margin: '0 -8px',
                opacity: isHighlighted
                  ? interpolate(lineProgress, [0, 1], [0, 1])
                  : 1,
              }}
            >
              {/* 行号 */}
              <span
                style={{
                  color: VIDEO_THEME.codeBlock.lineNumberColor,
                  marginRight: 24,
                  userSelect: 'none',
                  minWidth: 32,
                  textAlign: 'right',
                }}
              >
                {i + 1}
              </span>

              {/* 代码内容 */}
              <span style={{ color: VIDEO_THEME.text.code }}>
                {line}
                {/* 光标闪烁 */}
                {i === lines.length - 1 && charsToShow < totalChars && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 3,
                      height: '1em',
                      backgroundColor: VIDEO_THEME.text.accent,
                      marginLeft: 2,
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
