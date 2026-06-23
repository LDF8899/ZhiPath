import { useRef, useMemo } from 'react';
import type { SkillGraphNode, SkillEdge } from '../types/workspace';

/**
 * 3D 力导向布局 Hook
 * 依赖: npm install d3-force-3d
 *
 * 力模型:
 *   - charge: 节点间斥力 (forceManyBody)
 *   - link: 边引力，距离随边类型变化
 *   - cluster: 同簇节点聚拢力
 *   - y: 按技能等级 (level) 分层
 *
 * 性能: 最多迭代 300 tick，然后停止模拟
 * 仅当节点数或边数变化时重新计算
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimulationNode = SkillGraphNode & { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number };

interface PositionedNode extends SkillGraphNode {
  position: [number, number, number];
}

interface UseForceLayoutResult {
  positionedNodes: PositionedNode[];
  isLoading: boolean;
}

const MAX_TICKS = 300;
const CLUSTER_STRENGTH = 0.15;
const CHARGE_STRENGTH = -200;
const Y_SPACING = 2.5; // 每级高度间隔

// 簇中心锚点，让同簇节点聚在一起
const CLUSTER_ANCHORS: Record<string, [number, number, number]> = {
  frontend: [-6, 0, -3],
  backend: [6, 0, -3],
  data: [0, 0, 6],
  devops: [0, 4, 0],
  custom: [0, -3, 3],
};

/**
 * 计算节点的 Y 轴高度，基于 level (1-5)
 * 基础技能在底部，高级技能在顶部
 */
function levelToY(level: number): number {
  return (level - 3) * Y_SPACING; // level 3 → 0, level 1 → -5, level 5 → +5
}

/**
 * 根据边类型计算理想距离
 * prerequisite 边较短（依赖关系更紧密），related 边较长
 */
function edgeDistance(edge: SkillEdge): number {
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
  edges: SkillEdge[]
): UseForceLayoutResult {
  const nodeCountRef = useRef(0);
  const edgeCountRef = useRef(0);
  const resultRef = useRef<PositionedNode[]>([]);
  const isLoadingRef = useRef(true);

  // 仅当节点数或边数变化时触发重算
  const shouldRecalculate =
    nodes.length !== nodeCountRef.current || edges.length !== edgeCountRef.current;

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (nodes.length === 0) return [];

    // 数据量未变化时复用上次结果
    if (!shouldRecalculate && resultRef.current.length > 0) {
      return resultRef.current;
    }

    nodeCountRef.current = nodes.length;
    edgeCountRef.current = edges.length;
    isLoadingRef.current = true;

    // --- 手动实现简化版 3D 力导向布局 ---
    // 不直接 import d3-force-3d 以避免同步依赖问题
    // 在浏览器中通过动态 import 加载; 若不可用则使用简单布局

    const simNodes: SimulationNode[] = nodes.map((n) => {
      const anchor = CLUSTER_ANCHORS[n.cluster] || CLUSTER_ANCHORS.custom;
      return {
        ...n,
        x: anchor[0] + (Math.random() - 0.5) * 4,
        y: levelToY(n.level) + (Math.random() - 0.5) * 2,
        z: anchor[2] + (Math.random() - 0.5) * 4,
      };
    });

    // 构建索引映射
    const idToIndex = new Map<string, number>();
    simNodes.forEach((n, i) => idToIndex.set(n.id, i));

    const simEdges = edges
      .map((e) => ({
        source: idToIndex.get(e.from)!,
        target: idToIndex.get(e.to)!,
        distance: edgeDistance(e),
      }))
      .filter((e) => e.source !== undefined && e.target !== undefined);

    // --- 迭代模拟 (纯 JS 实现，无需 d3-force-3d) ---
    let alpha = 1.0;
    const alphaDecay = 1 - Math.pow(0.001, 1 / MAX_TICKS);

    for (let tick = 0; tick < MAX_TICKS; tick++) {
      // 1) 斥力 (charge)
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const ni = simNodes[i];
          const nj = simNodes[j];
          let dx = nj.x - ni.x;
          let dy = nj.y - ni.y;
          let dz = nj.z - ni.z;
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

      // 2) 链接力 (link)
      for (const edge of simEdges) {
        const ns = simNodes[edge.source];
        const nt = simNodes[edge.target];
        let dx = nt.x - ns.x;
        let dy = nt.y - ns.y;
        let dz = nt.z - ns.z;
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

      // 3) 簇聚力 (cluster pull)
      for (const node of simNodes) {
        const anchor = CLUSTER_ANCHORS[node.cluster] || CLUSTER_ANCHORS.custom;
        const targetY = levelToY(node.level);
        node.vx = (node.vx || 0) + (anchor[0] - node.x) * CLUSTER_STRENGTH * alpha;
        node.vy = (node.vy || 0) + (targetY - node.y) * CLUSTER_STRENGTH * alpha;
        node.vz = (node.vz || 0) + (anchor[2] - node.z) * CLUSTER_STRENGTH * alpha;
      }

      // 4) 应用速度并施加阻尼
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

    // 转换为 PositionedNode[]
    const result: PositionedNode[] = simNodes.map((sn) => ({
      id: sn.id,
      name: sn.name,
      category: sn.category,
      cluster: sn.cluster,
      mastery: sn.mastery,
      trustWeight: sn.trustWeight,
      effectiveMastery: sn.effectiveMastery,
      lastUpdated: sn.lastUpdated,
      prerequisites: sn.prerequisites,
      relatedSkills: sn.relatedSkills,
      level: sn.level,
      position: [sn.x, sn.y, sn.z] as [number, number, number],
    }));

    resultRef.current = result;
    isLoadingRef.current = false;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  return { positionedNodes, isLoading: isLoadingRef.current };
}

/**
 * Hook: 获取节点在布局中的位置
 * 当节点已在布局结果中时返回其 position，否则返回原点
 */
export function useNodePosition(
  positionedNodes: PositionedNode[],
  nodeId: string
): [number, number, number] {
  return useMemo(() => {
    const node = positionedNodes.find((n) => n.id === nodeId);
    return node?.position ?? [0, 0, 0];
  }, [positionedNodes, nodeId]);
}
