import React from 'react';
import { Composition } from 'remotion';
import { VideoGenerator } from './compositions/VideoGenerator';
import { VIDEO_THEME } from './types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoGenerator"
        component={VideoGenerator}
        durationInFrames={VIDEO_THEME.canvas.fps * 75} // 默认 75 秒，运行时由 inputProps 覆盖
        fps={VIDEO_THEME.canvas.fps}
        width={VIDEO_THEME.canvas.width}
        height={VIDEO_THEME.canvas.height}
        defaultProps={{
          script: {
            skill_name: 'React Hooks — useEffect',
            difficulty: 'beginner' as const,
            total_segments: 3,
            segments: [
              {
                id: 'seg_01',
                type: 'title_card' as const,
                narration: '今天我们来学习 React Hooks 中最重要的一个——useEffect。',
                visual: {
                  type: 'title' as const,
                  title: 'React Hooks: useEffect',
                  subtitle: '副作用处理的核心',
                },
                emphasis: ['useEffect'],
                estimated_duration_sec: 5,
              },
              {
                id: 'seg_02',
                type: 'bullet_points' as const,
                narration: 'useEffect 主要用于三个场景：数据获取、订阅事件、手动修改 DOM。',
                visual: {
                  type: 'bullets' as const,
                  items: ['数据获取（API 调用）', '订阅事件（WebSocket）', '手动修改 DOM'],
                  highlight_index: 0,
                },
                emphasis: ['数据获取', '订阅事件', '修改 DOM'],
                estimated_duration_sec: 8,
              },
              {
                id: 'seg_03',
                type: 'summary' as const,
                narration: '总结一下：useEffect 是处理副作用的 Hook，通过依赖数组控制执行时机。',
                visual: {
                  type: 'key_points' as const,
                  points: ['useEffect = 副作用 Hook', '依赖数组控制执行时机', '清理函数防止内存泄漏'],
                },
                emphasis: ['副作用', '依赖数组'],
                estimated_duration_sec: 7,
              },
            ],
          },
          audioSegments: [],
        }}
      />
    </>
  );
};
