import React from 'react';
import { AbsoluteFill } from 'remotion';
import { VIDEO_THEME } from '../types';

/**
 * 全局背景组件
 *
 * 深色渐变 + 微弱粒子效果
 */
export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse at 20% 50%, #1E1B4B20 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, #312E8115 0%, transparent 50%),
          ${VIDEO_THEME.canvas.backgroundColor}
        `,
      }}
    />
  );
};
