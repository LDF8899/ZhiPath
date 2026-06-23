import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * AgentCoverageOverlay — Agent 覆盖可视化
 *
 * 当某个 Agent 被选中/激活时，在其覆盖的节点上方显示
 * 半透明穹顶，颜色按 Agent 类型区分
 *
 * 交互: 点击高亮覆盖范围内的节点
 */

interface Props {
  agentType: string;
  coveredNodeIds: Set<string>;
  positionMap: Map<string, [number, number, number]>;
}

// 不同 Agent 类型的颜色
const AGENT_COLORS: Record<string, string> = {
  learning_planner: '#3b82f6',   // 蓝 — 学习规划
  exam_agent: '#8b5cf6',         // 紫 — 出题
  video_agent: '#f59e0b',        // 橙 — 视频生成
  match_agent: '#10b981',        // 绿 — 岗位匹配
  resume_agent: '#ec4899',       // 粉 — 简历优化
  coach_agent: '#06b6d4',        // 青 — 求职教练
};

export default function AgentCoverageOverlay({
  agentType,
  coveredNodeIds,
  positionMap,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 计算覆盖区域的中心和半径
  const { center, radius } = useMemo(() => {
    const coveredPositions: [number, number, number][] = [];
    for (const nodeId of coveredNodeIds) {
      const pos = positionMap.get(nodeId);
      if (pos) coveredPositions.push(pos);
    }

    if (coveredPositions.length === 0) {
      return { center: [0, 0, 0] as [number, number, number], radius: 1 };
    }

    // 中心点
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of coveredPositions) {
      sumX += p[0];
      sumY += p[1];
      sumZ += p[2];
    }
    const count = coveredPositions.length;
    const cx = sumX / count;
    const cy = sumY / count;
    const cz = sumZ / count;

    // 半径取最远节点距离 + 冗余
    let maxDist = 0;
    for (const p of coveredPositions) {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const dz = p[2] - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }

    return {
      center: [cx, cy + 1, cz] as [number, number, number], // 略微上移
      radius: maxDist + 2,
    };
  }, [coveredNodeIds, positionMap]);

  const color = AGENT_COLORS[agentType] || '#6366f1';

  // 微弱脉冲动画
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02;
    }
  });

  if (coveredNodeIds.size === 0) return null;

  return (
    <mesh ref={meshRef} position={center}>
      <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.06}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
