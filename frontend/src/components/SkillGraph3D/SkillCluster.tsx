import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * SkillCluster — 簇云
 *
 * 半透明球体包围同 cluster 的节点
 * 仅当 cluster 内节点数 > 3 时显示
 * 极低透明度 (0.03-0.05)，暗示分组即可
 */

interface Positional {
  position?: [number, number, number];
}

interface Props {
  cluster: string;
  nodes: Positional[];
}

const CLUSTER_TINT: Record<string, string> = {
  frontend: '#3b82f6',
  backend: '#10b981',
  data: '#f59e0b',
  devops: '#ef4444',
  custom: '#8b5cf6',
};

const MIN_NODES_FOR_CLOUD = 3;

export default function SkillCluster({ cluster, nodes }: Props) {
  // 仅节点数 > 3 时渲染
  if (nodes.length <= MIN_NODES_FOR_CLOUD) return null;

  // 计算包围球: 中心 + 半径
  const { center, radius } = useMemo(() => {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const n of nodes) {
      sumX += n.position?.[0] ?? 0;
      sumY += n.position?.[1] ?? 0;
      sumZ += n.position?.[2] ?? 0;
    }
    const count = nodes.length;
    const cx = sumX / count;
    const cy = sumY / count;
    const cz = sumZ / count;

    // 半径取最远节点距离 + 余量
    let maxDist = 0;
    for (const n of nodes) {
      const dx = (n.position?.[0] ?? 0) - cx;
      const dy = (n.position?.[1] ?? 0) - cy;
      const dz = (n.position?.[2] ?? 0) - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }

    return { center: [cx, cy, cz] as [number, number, number], radius: maxDist + 2 };
  }, [nodes]);

  const color = CLUSTER_TINT[cluster] || CLUSTER_TINT.custom;

  return (
    <mesh position={center}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.04}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
