import { useMemo, useRef } from 'react';
import type { SkillGraphEdge, SkillGraphNode } from './types';

/**
 * 3D 力导向布局 Hook（移植自旧前端，纯 JS 实现，无 d3 依赖）
 *
 * 力模型:
 *   - charge: 节点间斥力
 *   - link: 边引力，距离随边类型变化
 *   - cluster: 同簇节点向环形锚点聚拢
 *   - y: 按阶段序号 (level) 分层
 */

type SimulationNode = SkillGraphNode & {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
};

export interface PositionedNode extends SkillGraphNode {
  position: [number, number, number];
}

const MAX_TICKS = 300;
const CLUSTER_STRENGTH = 0.15;
const CHARGE_STRENGTH = -200;
const Y_SPACING = 2.5;
const RING_RADIUS = 7;

/** 簇锚点：按簇序号均匀分布在圆环上，让星座自然分区 */
export function clusterAnchors(clusters: string[]): Map<string, [number, number, number]> {
  const map = new Map<string, [number, number, number]>();
  const n = Math.max(clusters.length, 1);
  clusters.forEach((cluster, i) => {
    if (n === 1) {
      map.set(cluster, [0, 0, 0]);
      return;
    }
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    map.set(cluster, [Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS]);
  });
  return map;
}

function levelToY(level: number): number {
  return (level - 3) * Y_SPACING;
}

function edgeDistance(edge: SkillGraphEdge): number {
  switch (edge.type) {
    case 'prerequisite':
      return 2.5;
    case 'path':
      return 3.0;
    case 'related':
      return 4.5;
    default:
      return 3.5;
  }
}

export default function useForceLayout(
  nodes: SkillGraphNode[],
  edges: SkillGraphEdge[],
): { positionedNodes: PositionedNode[] } {
  const nodeCountRef = useRef(-1);
  const edgeCountRef = useRef(-1);
  const resultRef = useRef<PositionedNode[]>([]);

  const shouldRecalculate =
    nodes.length !== nodeCountRef.current || edges.length !== edgeCountRef.current;

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (nodes.length === 0) return [];
    if (!shouldRecalculate && resultRef.current.length > 0) {
      return resultRef.current;
    }
    nodeCountRef.current = nodes.length;
    edgeCountRef.current = edges.length;

    const clusters = [...new Set(nodes.map((n) => n.cluster))];
    const anchors = clusterAnchors(clusters);

    const simNodes: SimulationNode[] = nodes.map((n) => {
      const anchor = anchors.get(n.cluster) || [0, 0, 0];
      return {
        ...n,
        x: anchor[0] + (Math.random() - 0.5) * 4,
        y: levelToY(n.level) + (Math.random() - 0.5) * 2,
        z: anchor[2] + (Math.random() - 0.5) * 4,
      };
    });

    const idToIndex = new Map<string, number>();
    simNodes.forEach((n, i) => idToIndex.set(n.id, i));

    const simEdges = edges
      .map((e) => ({
        source: idToIndex.get(e.from),
        target: idToIndex.get(e.to),
        distance: edgeDistance(e),
      }))
      .filter((e): e is { source: number; target: number; distance: number } => e.source !== undefined && e.target !== undefined);

    let alpha = 1.0;
    const alphaDecay = 1 - Math.pow(0.001, 1 / MAX_TICKS);

    for (let tick = 0; tick < MAX_TICKS; tick++) {
      // 斥力
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const ni = simNodes[i];
          const nj = simNodes[j];
          const dx = nj.x - ni.x;
          const dy = nj.y - ni.y;
          const dz = nj.z - ni.z;
          const distSq = dx * dx + dy * dy + dz * dz + 0.01;
          const dist = Math.sqrt(distSq);
          const force = (CHARGE_STRENGTH * alpha) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          ni.vx = (ni.vx || 0) - fx;
          ni.vy = (ni.vy || 0) - fy;
          ni.vz = (ni.vz || 0) - fz;
          nj.vx = (nj.vx || 0) + fx;
          nj.vy = (nj.vy || 0) + fy;
          nj.vz = (nj.vz || 0) + fz;
        }
      }

      // 链接力
      for (const edge of simEdges) {
        const ns = simNodes[edge.source];
        const nt = simNodes[edge.target];
        const dx = nt.x - ns.x;
        const dy = nt.y - ns.y;
        const dz = nt.z - ns.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);
        const force = (dist - edge.distance) * 0.05 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        ns.vx = (ns.vx || 0) + fx;
        ns.vy = (ns.vy || 0) + fy;
        ns.vz = (ns.vz || 0) + fz;
        nt.vx = (nt.vx || 0) - fx;
        nt.vy = (nt.vy || 0) - fy;
        nt.vz = (nt.vz || 0) - fz;
      }

      // 簇聚力 + 分层
      for (const node of simNodes) {
        const anchor = anchors.get(node.cluster) || [0, 0, 0];
        const targetY = levelToY(node.level);
        node.vx = (node.vx || 0) + (anchor[0] - node.x) * CLUSTER_STRENGTH * alpha;
        node.vy = (node.vy || 0) + (targetY - node.y) * CLUSTER_STRENGTH * alpha;
        node.vz = (node.vz || 0) + (anchor[2] - node.z) * CLUSTER_STRENGTH * alpha;
      }

      // 阻尼 + 位移
      for (const node of simNodes) {
        node.vx = (node.vx || 0) * 0.6;
        node.vy = (node.vy || 0) * 0.6;
        node.vz = (node.vz || 0) * 0.6;
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;
      }

      alpha *= 1 - alphaDecay;
    }

    const result: PositionedNode[] = simNodes.map((sn) => ({
      ...sn,
      position: [sn.x, sn.y, sn.z] as [number, number, number],
    }));

    resultRef.current = result;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  return { positionedNodes };
}
