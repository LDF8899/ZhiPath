import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { VIDEO_THEME } from '../types';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const scanY = interpolate(frame % 180, [0, 180], [-120, VIDEO_THEME.canvas.height + 120]);

  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 1)),
          ${VIDEO_THEME.canvas.backgroundColor}
        `,
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          opacity: 0.42,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 120,
          background: `linear-gradient(180deg, transparent, ${VIDEO_THEME.text.accent}12, transparent)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `
            linear-gradient(90deg, rgba(2, 6, 23, 0.88), transparent 18%, transparent 82%, rgba(2, 6, 23, 0.88)),
            linear-gradient(180deg, rgba(2, 6, 23, 0.94), transparent 22%, transparent 78%, rgba(2, 6, 23, 0.96))
          `,
        }}
      />
    </AbsoluteFill>
  );
};
