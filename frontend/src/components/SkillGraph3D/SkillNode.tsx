import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { SkillGraphNode } from '../../types/workspace';

/**
 * SkillNode — 单个技能节点
 *
 * 视觉编码:
 *   - 大小: 0.1 + (mastery / 100) * 0.4 半径
 *   - 颜色: 按分类
 *   - 发光: 7天内更新的节点有呼吸光效
 *   - 透明度: 0.4 + trustWeight * 0.6
 *   - 选中时: emissive 增强
 *   - 标签: Html overlay，显示名称 + mastery%
 */

interface Props {
  node: SkillGraphNode;
  position: [number, number, number];
  isSelected?: boolean;
  isHighlighted?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  onClick?: (nodeId: string) => void;
}

// 分类颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  '前端基础': '#3b82f6',
  '前端框架': '#8b5cf6',
  '后端': '#10b981',
  '数据库': '#f59e0b',
  'DevOps': '#ef4444',
  '软技能': '#ec4899',
};

// cluster → 基础色 (用于无精确匹配时的降级)
const CLUSTER_COLORS: Record<string, string> = {
  frontend: '#3b82f6',
  backend: '#10b981',
  data: '#f59e0b',
  devops: '#ef4444',
  custom: '#8b5cf6',
};

/** 获取节点颜色 */
function getNodeColor(category: string, cluster: string): string {
  return CATEGORY_COLORS[category] || CLUSTER_COLORS[cluster] || '#6366f1';
}

/** 7 天内更新视为 "近期活跃" */
const RECENT_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

export default function SkillNode({
  node,
  position,
  isSelected = false,
  isHighlighted = false,
  showLabel = true,
  compact = false,
  onClick,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // 计算视觉参数
  const radius = 0.1 + (node.mastery / 100) * 0.4;
  const opacity = 0.4 + node.trustWeight * 0.6;
  const color = getNodeColor(node.category, node.cluster);
  const isRecent = Date.now() - node.lastUpdated < RECENT_THRESHOLD;

  // 发光强度由选中态和近期活跃决定
  const emissiveIntensity = useMemo(() => {
    if (isSelected) return 1.5;
    if (isHighlighted) return 1.0;
    if (isRecent) return 0.5;
    return 0.1;
  }, [isSelected, isHighlighted, isRecent]);

  // 呼吸光效: 近期活跃的节点有脉冲效果
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    if (isRecent && !isSelected) {
      // 呼吸光效: 慢速正弦波动
      const breath = 0.5 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.3;
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = breath;
      }
    }

    // 选中态微微上浮
    if (isSelected) {
      const hover = Math.sin(clock.getElapsedTime() * 3) * 0.05;
      meshRef.current.position.y = position[1] + hover;
    }

    // 发光层随时间旋转
    if (glowRef.current) {
      glowRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onClick?.(node.id);
  };

  // mastery = 0 且 compact 模式不渲染标签
  const shouldShowLabel = showLabel && node.mastery > 0;

  return (
    <Float
      speed={isRecent ? 1.5 : 0.8}
      rotationIntensity={0}
      floatIntensity={isRecent ? 0.3 : 0.1}
      floatingRange={[-0.05, 0.05]}
    >
      <group position={position}>
        {/* 主球体 */}
        <mesh
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default';
          }}
        >
          <sphereGeometry args={[radius, 32, 32]} />
          <meshStandardMaterial
            ref={materialRef}
            color={color}
            transparent
            opacity={opacity}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>

        {/* 外层发光光晕 */}
        {(isSelected || isRecent || isHighlighted) && (
          <mesh ref={glowRef} scale={1.8}>
            <sphereGeometry args={[radius, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={isSelected ? 0.15 : 0.06}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* 标签 */}
        {shouldShowLabel && (
          <Html
            position={[0, radius + 0.3, 0]}
            center
            distanceFactor={8}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              className={`px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm transition-opacity ${
                compact && !isSelected ? 'opacity-60' : 'opacity-100'
              }`}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#e5e7eb',
                borderLeft: `2px solid ${color}`,
                fontSize: compact ? '10px' : '11px',
              }}
            >
              <span>{node.name}</span>
              <span className="ml-1 text-gray-400">{node.mastery}%</span>
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}
