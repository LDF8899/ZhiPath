import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoScript, VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface Props {
  script: VideoScript;
  segment: VideoSegment;
  segmentIndex: number;
  totalSegments: number;
  durationFrames: number;
}

const difficultyLabel: Record<string, string> = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
};

export const SceneChrome: React.FC<Props> = ({
  script,
  segment,
  segmentIndex,
  totalSegments,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, durationFrames)));
  const calloutProgress = spring({ frame: frame - Math.round(durationFrames * 0.38), fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: VIDEO_THEME.chrome.safeX,
          right: VIDEO_THEME.chrome.safeX,
          height: VIDEO_THEME.chrome.topBarHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: interpolate(intro, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(intro, [0, 1], [-12, 0])}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 12,
              height: 42,
              borderRadius: 999,
              background: `linear-gradient(180deg, ${VIDEO_THEME.text.accent}, ${VIDEO_THEME.chrome.accent2})`,
            }}
          />
          <div>
            <div
              style={{
                color: VIDEO_THEME.text.primary,
                fontFamily: VIDEO_THEME.fonts.heading,
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              {script.skill_name}
            </div>
            <div
              style={{
                color: VIDEO_THEME.text.secondary,
                fontFamily: VIDEO_THEME.fonts.code,
                fontSize: 15,
                marginTop: 6,
                textTransform: 'uppercase',
              }}
            >
              {difficultyLabel[script.difficulty] || script.difficulty} / SCENE {segmentIndex + 1}
            </div>
          </div>
        </div>

        <div
          style={{
            color: VIDEO_THEME.text.secondary,
            fontFamily: VIDEO_THEME.fonts.code,
            fontSize: 18,
          }}
        >
          {String(segmentIndex + 1).padStart(2, '0')} / {String(totalSegments).padStart(2, '0')}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 116,
          left: VIDEO_THEME.chrome.safeX,
          right: VIDEO_THEME.chrome.safeX,
          height: 3,
          background: 'rgba(148, 163, 184, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${VIDEO_THEME.text.accent}, ${VIDEO_THEME.chrome.accent2})`,
          }}
        />
      </div>

      {segment.scene_goal && (
        <div
          style={{
            position: 'absolute',
            top: 142,
            left: VIDEO_THEME.chrome.safeX,
            color: VIDEO_THEME.text.secondary,
            fontFamily: VIDEO_THEME.fonts.body,
            fontSize: 22,
            opacity: interpolate(intro, [0, 1], [0, 0.85]),
          }}
        >
          {segment.scene_goal}
        </div>
      )}

      {segment.callout && (
        <div
          style={{
            position: 'absolute',
            right: VIDEO_THEME.chrome.safeX,
            bottom: 190,
            maxWidth: 520,
            padding: '18px 24px',
            borderRadius: 8,
            border: `1px solid ${VIDEO_THEME.text.accent}55`,
            background: 'rgba(15, 23, 42, 0.82)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.28)',
            opacity: interpolate(calloutProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(calloutProgress, [0, 1], [20, 0], { extrapolateRight: 'clamp' })}px)`,
          }}
        >
          <div
            style={{
              color: VIDEO_THEME.chrome.accent2,
              fontFamily: VIDEO_THEME.fonts.code,
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            KEY TAKEAWAY
          </div>
          <div
            style={{
              color: VIDEO_THEME.text.primary,
              fontFamily: VIDEO_THEME.fonts.heading,
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.35,
            }}
          >
            {segment.callout}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
