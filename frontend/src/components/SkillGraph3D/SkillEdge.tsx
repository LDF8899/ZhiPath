import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * SkillEdge — 两点间的连接线
 *
 * - prerequisite 边: 绿色 (#4ade80) 当两端 mastery > 50，否则灰色 (#374151)
 * - Quadratic bezier 曲线
 * - prerequisite 边向上微弯, related 边较直
 * - 宽度与 strength 成正比
 */

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  type: 'prerequisite' | 'related' | 'path';
  strength: number;
  fromMastery?: number;
  toMastery?: number;
}

/** 两点中点向上偏移，生成弯曲效果 */
function computeControlPoint(
  from: [number, number, number],
  to: [number, number, number],
  type: string
): [number, number, number] {
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  // prerequisite 边向上弯曲更明显
  const lift = type === 'prerequisite' ? 1.2 : 0.3;

  return [midX, midY + lift, midZ];
}

export default function SkillEdge({
  from,
  to,
  type,
  strength,
  fromMastery = 50,
  toMastery = 50,
}: Props) {
  // 构建 bezier 曲线
  const curve = useMemo(() => {
    const control = computeControlPoint(from, to, type);
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...from),
      new THREE.Vector3(...control),
      new THREE.Vector3(...to)
    );
  }, [from, to, type]);

  // 从曲线取样生成几何体
  const points = useMemo(() => curve.getPoints(32), [curve]);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  // 颜色: 两端 mastery > 50 → 绿色, 否则灰色
  const bothMastered = fromMastery > 50 && toMastery > 50;
  const baseColor = bothMastered ? '#4ade80' : '#374151';

  // 透明度: related 边更透明
  const opacity = type === 'related' ? 0.15 + strength * 0.15 : 0.3 + strength * 0.4;

  // 线宽: strength 映射到 0.5 - 2.0
  const lineWidth = 0.5 + strength * 1.5;

  return (
    <group>
      <line geometry={geometry}>
        <lineBasicMaterial
          color={baseColor}
          transparent
          opacity={opacity}
          linewidth={lineWidth}
        />
      </line>
    </group>
  );
}
