import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  AbsoluteFill,
  Audio,
  staticFile,
} from 'remotion';
import { TitleCard } from './TitleCard';
import { BulletPoints } from './BulletPoints';
import { CodeWalkthrough } from './CodeWalkthrough';
import { Diagram } from './Diagram';
import { Comparison } from './Comparison';
import { Summary } from './Summary';
import { HighlightReel } from './HighlightReel';
import { SubtitleOverlay } from '../components/SubtitleOverlay';
import { Background } from '../components/Background';
import type { VideoScript, AudioSegment, VideoSegment } from '../types';
import { VIDEO_THEME } from '../types';

interface VideoGeneratorProps {
  script: VideoScript;
  audioSegments: AudioSegment[];
}

/**
 * 视频根组件
 *
 * 根据脚本 JSON 的 segments 顺序渲染，每个 segment 是一个 Sequence。
 * 时长由 TTS 音频的 duration_sec 驱动（audioSegments），fallback 到 estimated_duration_sec。
 * 每个 Sequence 内嵌该段的 <Audio>，使解说词与画面帧级锁定、烤进同一个 mp4。
 */
export const VideoGenerator: React.FC<VideoGeneratorProps> = ({
  script,
  audioSegments,
}) => {
  const { fps } = useVideoConfig();

  // 计算每个 segment 的起止帧
  const segmentFrames = calculateSegmentFrames(script.segments, audioSegments, fps);

  return (
    <AbsoluteFill>
      <Background />

      {script.segments.map((segment, index) => {
        const sf = segmentFrames[index];
        if (!sf) return null;

        const audio = audioSegments.find((a) => a.id === segment.id);

        return (
          <Sequence
            key={segment.id}
            from={sf.startFrame}
            durationInFrames={sf.durationFrames}
          >
            {renderSegment(segment, sf.durationFrames)}
            {audio?.staticSrc && <Audio src={staticFile(audio.staticSrc)} />}
          </Sequence>
        );
      })}

      {/* 字幕叠加层（narration 文本） */}
      <Sequence from={0}>
        <SubtitleOverlay
          segments={script.segments}
          segmentFrames={segmentFrames}
          fps={fps}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 根据 segment 类型渲染对应组件 */
function renderSegment(segment: VideoSegment, durationFrames: number): React.ReactNode {
  switch (segment.type) {
    case 'title_card':
      return <TitleCard segment={segment} />;
    case 'bullet_points':
      return <BulletPoints segment={segment} durationFrames={durationFrames} />;
    case 'code_walkthrough':
      return <CodeWalkthrough segment={segment} />;
    case 'diagram':
      return <Diagram segment={segment} />;
    case 'comparison':
      return <Comparison segment={segment} />;
    case 'summary':
      return <Summary segment={segment} />;
    case 'highlight_reel':
      return <HighlightReel segment={segment} />;
    case 'formula':
      // formula 暂用 summary 组件渲染
      return <Summary segment={segment} />;
    default:
      return <BulletPoints segment={segment} durationFrames={durationFrames} />;
  }
}

/** 计算每个 segment 的起止帧 */
function calculateSegmentFrames(
  segments: VideoSegment[],
  audioSegments: AudioSegment[],
  fps: number,
): Array<{ startFrame: number; durationFrames: number }> {
  const frames: Array<{ startFrame: number; durationFrames: number }> = [];
  let currentFrame = 0;

  for (const seg of segments) {
    // 优先用 audio 的精确时长，fallback 到 estimated_duration_sec
    const audio = audioSegments.find(a => a.id === seg.id);
    const durationSec = audio?.duration_sec || seg.audio?.duration_sec || seg.estimated_duration_sec;
    // round（非 ceil）：与 render.ts 总帧数口径一致，消除逐段向上取整的累积漂移
    const durationFrames = Math.max(1, Math.round(durationSec * fps));

    frames.push({
      startFrame: currentFrame,
      durationFrames,
    });

    currentFrame += durationFrames;
  }

  return frames;
}
