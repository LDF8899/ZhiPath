import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  segments: VideoSegment[];
  segmentFrames: Array<{ startFrame: number; durationFrames: number }>;
  fps: number;
}

export const SubtitleOverlay: React.FC<Props> = ({
  segments,
  segmentFrames,
  fps,
}) => {
  const frame = useCurrentFrame();
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
  const chunks = splitNarration(segment.narration);
  const chunkIndex = Math.min(
    chunks.length - 1,
    Math.floor((localFrame / Math.max(1, sf.durationFrames)) * chunks.length),
  );
  const text = chunks[chunkIndex] || segment.narration;
  const chunkStart = Math.floor((sf.durationFrames / chunks.length) * chunkIndex);
  const chunkEnd = Math.floor((sf.durationFrames / chunks.length) * (chunkIndex + 1));
  const fadeIn = interpolate(localFrame - chunkStart, [0, Math.round(fps * 0.16)], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [chunkEnd - Math.round(fps * 0.2), chunkEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.max(0, Math.min(fadeIn, fadeOut));
  const keywords = Array.from(new Set([...(segment.keywords || []), ...(segment.emphasis || [])].filter(Boolean)));

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
          bottom: 56,
          left: '50%',
          transform: `translateX(-50%) translateY(${interpolate(opacity, [0, 1], [8, 0])}px)`,
          width: 'min(1320px, 76%)',
          padding: '16px 30px',
          background: 'rgba(2, 6, 23, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: 8,
          opacity,
          boxShadow: '0 18px 54px rgba(0, 0, 0, 0.25)',
        }}
      >
        <span
          style={{
            fontSize: 34,
            color: VIDEO_THEME.text.primary,
            fontFamily: VIDEO_THEME.fonts.body,
            lineHeight: 1.42,
            letterSpacing: 0,
          }}
        >
          {highlightText(text, keywords)}
        </span>
      </div>
    </AbsoluteFill>
  );
};

function splitNarration(narration: string): string[] {
  const raw = String(narration || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [''];
  const chunks = raw
    .split(/(?<=[。！？.!?；;])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length <= 1 && raw.length > 44) {
    const result: string[] = [];
    for (let i = 0; i < raw.length; i += 38) {
      result.push(raw.slice(i, i + 38));
    }
    return result;
  }
  return chunks.length ? chunks : [raw];
}

function highlightText(text: string, keywords: string[]): React.ReactNode[] {
  const valid = keywords
    .map((kw) => String(kw || '').trim())
    .filter((kw) => kw.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
  if (!valid.length) return [text];

  const pattern = new RegExp(`(${valid.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const matched = valid.some((kw) => kw.toLowerCase() === part.toLowerCase());
    return matched ? (
      <span key={index} style={{ color: VIDEO_THEME.chrome.accent2, fontWeight: 800 }}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
