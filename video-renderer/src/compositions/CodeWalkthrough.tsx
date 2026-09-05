import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CodeWalkthroughVisual, VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segment: VideoSegment;
  durationFrames: number;
}

export const CodeWalkthrough: React.FC<Props> = ({ segment, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visual = segment.visual as CodeWalkthroughVisual;

  if (visual.type !== 'code') return null;

  const { code, language, highlight_lines = [], typing_effect = true } = visual;
  const totalChars = code.length;
  const charsToShow = typing_effect
    ? Math.floor(interpolate(frame, [0, durationFrames * 0.72], [0, totalChars], {
        extrapolateRight: 'clamp',
      }))
    : totalChars;

  const displayCode = code.slice(0, charsToShow);
  const lines = displayCode.split('\n');
  const fullLines = code.split('\n');
  const highlightSet = new Set(highlight_lines);
  const activeHighlightIndex = Math.min(
    Math.max(0, Math.floor(interpolate(frame, [durationFrames * 0.22, durationFrames * 0.86], [0, Math.max(0, highlight_lines.length - 1)], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }))),
    Math.max(0, highlight_lines.length - 1),
  );
  const activeLine = highlight_lines[activeHighlightIndex];
  const titleProgress = spring({ frame, fps, config: { damping: 12 } });
  const fileName = `${segment.id.replace(/^seg_/, 'lesson_')}.${fileExtension(language)}`;
  const fontSize = Math.max(25, Math.min(34, 720 / Math.max(1, fullLines.length)));

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: `140px ${VIDEO_THEME.chrome.safeX}px ${VIDEO_THEME.layout.contentSafeBottom}px`,
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
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
        {language} / walkthrough
      </div>

      <div
        style={{
          background: VIDEO_THEME.codeBlock.background,
          border: `1px solid ${VIDEO_THEME.codeBlock.border}`,
          borderRadius: 14,
          fontFamily: VIDEO_THEME.fonts.code,
          fontSize,
          lineHeight: 1.6,
          overflow: 'hidden',
          boxShadow: '0 24px 90px rgba(0, 0, 0, 0.34)',
        }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            borderBottom: `1px solid ${VIDEO_THEME.codeBlock.border}`,
            background: 'rgba(15, 23, 42, 0.72)',
          }}
        >
          <div style={{ display: 'flex', gap: 9, marginRight: 22 }}>
            {['#F87171', '#FBBF24', '#34D399'].map((color) => (
              <span key={color} style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            ))}
          </div>
          <span style={{ color: VIDEO_THEME.text.secondary, fontSize: 17 }}>{fileName}</span>
        </div>

        <div style={{ padding: '28px 36px 34px' }}>
          {lines.map((line, i) => {
            const lineNo = i + 1;
            const isHighlighted = highlightSet.has(lineNo);
            const isActive = activeLine === lineNo;
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
                  background: isActive
                    ? 'rgba(129, 140, 248, 0.24)'
                    : isHighlighted
                      ? VIDEO_THEME.codeBlock.highlightBackground
                      : 'transparent',
                  borderRadius: 6,
                  padding: '2px 10px',
                  margin: '0 -8px',
                  borderLeft: isActive ? `4px solid ${VIDEO_THEME.chrome.accent2}` : '4px solid transparent',
                  opacity: isHighlighted ? interpolate(lineProgress, [0, 1], [0, 1]) : 1,
                }}
              >
                <span
                  style={{
                    color: VIDEO_THEME.codeBlock.lineNumberColor,
                    marginRight: 24,
                    userSelect: 'none',
                    minWidth: 42,
                    textAlign: 'right',
                  }}
                >
                  {lineNo}
                </span>

                <span style={{ color: VIDEO_THEME.text.primary, whiteSpace: 'pre' }}>
                  {colorizeCode(line)}
                  {i === lines.length - 1 && charsToShow < totalChars && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 3,
                        height: '1em',
                        backgroundColor: VIDEO_THEME.text.accent,
                        marginLeft: 2,
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

function fileExtension(language: string): string {
  const normalized = String(language || '').toLowerCase();
  if (normalized.includes('python')) return 'py';
  if (normalized.includes('javascript')) return 'js';
  if (normalized.includes('typescript')) return 'ts';
  if (normalized.includes('tsx')) return 'tsx';
  if (normalized.includes('jsx')) return 'jsx';
  if (normalized.includes('css')) return 'css';
  return normalized || 'txt';
}

function colorizeCode(line: string): React.ReactNode[] {
  const tokens = line.split(/(\b(?:const|let|var|function|return|if|else|await|async|import|from|export|type|interface|class|new)\b|["'`][^"'`]*["'`]|\/\/.*|\b\d+\b)/g);
  return tokens.map((token, index) => {
    let color: string = VIDEO_THEME.text.primary;
    if (/^(const|let|var|function|return|if|else|await|async|import|from|export|type|interface|class|new)$/.test(token)) {
      color = VIDEO_THEME.text.accent;
    } else if (/^["'`]/.test(token)) {
      color = VIDEO_THEME.chrome.success;
    } else if (/^\/\//.test(token)) {
      color = VIDEO_THEME.text.secondary;
    } else if (/^\d+$/.test(token)) {
      color = VIDEO_THEME.chrome.warning;
    }
    return <span key={index} style={{ color }}>{token}</span>;
  });
}
