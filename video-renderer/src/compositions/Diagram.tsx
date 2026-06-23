import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';
import type { VideoSegment, DiagramVisual } from '../types';
import { VIDEO_THEME } from '../types';
import { ensureFinite } from '../utils/safeInterpolate';

interface Props {
  segment: VideoSegment;
}

/**
 * 流程图组件
 *
 * 节点依次点亮 + 连线逐步绘制
 */
export const Diagram: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const visual = segment.visual as DiagramVisual;

  if (visual.type !== 'flowchart') return null;

  // 过滤掉无效节点（坐标缺失或非数字）
  const { nodes: rawNodes, edges } = visual;
  const nodes = rawNodes.filter(
    (n) => typeof n.x === 'number' && typeof n.y === 'number' && n.id,
  );
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodeDelay = Math.floor(durationInFrames * 0.15);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: VIDEO_THEME.canvas.backgroundColor,
      }}
    >
      <svg
        width={VIDEO_THEME.canvas.width - 200}
        height={VIDEO_THEME.canvas.height - 200}
        viewBox={`0 0 ${VIDEO_THEME.canvas.width - 200} ${VIDEO_THEME.canvas.height - 200}`}
      >
        {/* 连线 */}
        {edges
          .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
          .map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from)!;
            const toNode = nodes.find((n) => n.id === edge.to)!;

            const edgeProgress = spring({
              frame: frame - (i + 1) * nodeDelay,
              fps,
              config: { damping: 15, stiffness: 60 },
            });

            const x1 = ensureFinite(fromNode.x);
            const y1 = ensureFinite(fromNode.y);
            const x2 = interpolate(edgeProgress, [0, 1], [x1, ensureFinite(toNode.x)]);
            const y2 = interpolate(edgeProgress, [0, 1], [y1, ensureFinite(toNode.y)]);

          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={VIDEO_THEME.text.accent}
                strokeWidth={3}
                strokeDasharray={`${interpolate(edgeProgress, [0, 1], [0, 1000])} 1000`}
              />

              {/* 连线标签 */}
              {edge.label && edgeProgress > 0.5 && (
                <text
                  x={(x1 + toNode.x) / 2}
                  y={(y1 + toNode.y) / 2 - 12}
                  fill={VIDEO_THEME.text.secondary}
                  fontSize={20}
                  textAnchor="middle"
                  fontFamily={VIDEO_THEME.fonts.body}
                  opacity={interpolate(edgeProgress, [0.5, 0.8], [0, 1])}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* 节点 */}
        {nodes.map((node, i) => {
          const nodeProgress = spring({
            frame: frame - i * nodeDelay,
            fps,
            config: { damping: 10, stiffness: 80 },
          });

          const opacity = interpolate(nodeProgress, [0, 1], [0, 1]);
          const scale = interpolate(nodeProgress, [0, 1], [0.5, 1]);
          const glow = interpolate(nodeProgress, [0, 0.5, 1], [0, 20, 0]);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
              opacity={opacity}
            >
              {/* 节点背景 */}
              <rect
                x={-80}
                y={-30}
                width={160}
                height={60}
                rx={12}
                fill={VIDEO_THEME.codeBlock.background}
                stroke={VIDEO_THEME.text.accent}
                strokeWidth={2}
                filter={glow > 0 ? `drop-shadow(0 0 ${glow}px ${VIDEO_THEME.text.accent})` : undefined}
              />

              {/* 节点文字 */}
              <text
                fill={VIDEO_THEME.text.primary}
                fontSize={22}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={VIDEO_THEME.fonts.body}
                fontWeight={600}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
