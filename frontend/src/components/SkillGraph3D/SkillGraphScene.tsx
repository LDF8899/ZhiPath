/**
 * SkillGraphScene — R3D 主场景
 *
 * 必需依赖 (请先安装):
 *   npm install @react-three/fiber @react-three/drei @react-three/postprocessing
 *   npm install @react-spring/three d3-force-3d three
 *
 * @types/three 会随 @react-three/fiber 自动安装
 */

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphSnapshot } from '../../types/workspace';
import useForceLayout from '../../hooks/useForceLayout';
import SkillNode from './SkillNode';
import SkillEdge from './SkillEdge';
import SkillCluster from './SkillCluster';
import NodeDetail from './NodeDetail';
import GraphControls from './GraphControls';
import AgentCoverageOverlay from './AgentCoverageOverlay';

interface Props {
  snapshot: GraphSnapshot;
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  onNodeAgentDrop?: (agentKey: string, nodeId: string) => void;
  agentCoverageMap?: Record<string, string[]>;
  compareSnapshot?: GraphSnapshot;
  compact?: boolean;
}

/**
 * 背景星空粒子 — 简单的点阵模拟宇宙背景
 */
function StarField({ count = 500 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    return arr;
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 0.02 + Math.random() * 0.06;
    }
    return arr;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#4a5568"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * 场景内容 — 放在 Canvas 内部，使用 R3F hooks
 */
function SceneContent({
  snapshot,
  selectedNodeId,
  onNodeClick,
  onNodeAgentDrop,
  agentCoverageMap,
  compact,
}: Omit<Props, 'compareSnapshot'>) {
  const { positionedNodes } = useForceLayout(snapshot.nodes, snapshot.edges);
  const [showLabels, setShowLabels] = useState(!compact);
  const [showClusters, setShowClusters] = useState(!compact);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(snapshot.nodes.map((n) => n.category))
  );
  const [hoveredAgentType, setHoveredAgentType] = useState<string | null>(null);

  // 按节点 ID 索引位置
  const positionMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    for (const n of positionedNodes) {
      map.set(n.id, n.position);
    }
    return map;
  }, [positionedNodes]);

  // 按类别过滤节点
  const visibleNodes = useMemo(
    () => positionedNodes.filter((n) => activeCategories.has(n.category)),
    [positionedNodes, activeCategories]
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );

  // 过滤边：两端都可见才渲染
  const visibleEdges = useMemo(
    () =>
      snapshot.edges.filter(
        (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
      ),
    [snapshot.edges, visibleNodeIds]
  );

  // 按 cluster 分组
  const clusterGroups = useMemo(() => {
    const groups = new Map<string, typeof visibleNodes>();
    for (const node of visibleNodes) {
      const arr = groups.get(node.cluster) || [];
      arr.push(node);
      groups.set(node.cluster, arr);
    }
    return groups;
  }, [visibleNodes]);

  // 所有类别
  const allCategories = useMemo(
    () => [...new Set(snapshot.nodes.map((n) => n.category))],
    [snapshot.nodes]
  );

  // Agent 覆盖的节点
  const agentCoveredNodeIds = useMemo(() => {
    if (!hoveredAgentType || !agentCoverageMap) return new Set<string>();
    return new Set(agentCoverageMap[hoveredAgentType] || []);
  }, [hoveredAgentType, agentCoverageMap]);

  return (
    <>
      {/* 光照 */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 15, 10]} intensity={0.8} color="#e0e7ff" />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#312e81" />

      {/* 星空背景 */}
      <StarField count={compact ? 200 : 500} />

      {/* 相机控制 */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={40}
        enablePan
        autoRotate={false}
        makeDefault
      />

      {/* 簇云 */}
      {showClusters &&
        Array.from(clusterGroups.entries()).map(([cluster, nodes]) => (
          <SkillCluster
            key={cluster}
            cluster={cluster}
            nodes={nodes}
          />
        ))}

      {/* 边 */}
      {visibleEdges.map((edge) => {
        const fromPos = positionMap.get(edge.from);
        const toPos = positionMap.get(edge.to);
        if (!fromPos || !toPos) return null;
        return (
          <SkillEdge
            key={`${edge.from}-${edge.to}`}
            from={fromPos}
            to={toPos}
            type={edge.type}
            strength={edge.strength}
          />
        );
      })}

      {/* 节点 */}
      {visibleNodes.map((node) => (
        <SkillNode
          key={node.id}
          node={node}
          position={node.position}
          isSelected={selectedNodeId === node.id}
          isHighlighted={agentCoveredNodeIds.has(node.id)}
          showLabel={showLabels}
          compact={compact}
          onClick={onNodeClick}
        />
      ))}

      {/* Agent 覆盖层 */}
      {agentCoverageMap && hoveredAgentType && (
        <AgentCoverageOverlay
          agentType={hoveredAgentType}
          coveredNodeIds={agentCoveredNodeIds}
          positionMap={positionMap}
        />
      )}

      {/* 控制面板 (作为 HTML overlay 渲染在 DOM 中) */}
      <GraphControls
        showLabels={showLabels}
        showClusters={showClusters}
        categories={allCategories}
        activeCategories={activeCategories}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onToggleClusters={() => setShowClusters((v) => !v)}
        onToggleCategory={(cat) =>
          setActiveCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) {
              next.delete(cat);
            } else {
              next.add(cat);
            }
            return next;
          })
        }
      />
    </>
  );
}

export default function SkillGraphScene({
  snapshot,
  selectedNodeId,
  onNodeClick,
  onNodeAgentDrop,
  agentCoverageMap,
  compact = false,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 选中的节点详情
  const selectedNode = useMemo(
    () => snapshot.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [snapshot.nodes, selectedNodeId]
  );

  // Agent 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const agentKey = e.dataTransfer.getData('application/x-agent-key');
      if (!agentKey || !selectedNodeId) return;
      onNodeAgentDrop?.(agentKey, selectedNodeId);
    },
    [selectedNodeId, onNodeAgentDrop]
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Canvas
        camera={{ position: [0, 2, 12], fov: 60, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#0a0a0f' }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 20, 50]} />
        <Suspense fallback={null}>
          <SceneContent
            snapshot={snapshot}
            selectedNodeId={selectedNodeId}
            onNodeClick={onNodeClick}
            onNodeAgentDrop={onNodeAgentDrop}
            agentCoverageMap={agentCoverageMap}
            compact={compact}
          />
        </Suspense>
      </Canvas>

      {/* 节点详情面板 */}
      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          onClose={() => onNodeClick?.('')}
        />
      )}
    </div>
  );
}
