import { useState, useCallback, useEffect } from 'react';
import type { GraphSnapshot } from '../../types/workspace';
import SkillGraphScene from './SkillGraphScene';

/**
 * SkillGraph3D 入口组件
 *
 * 职责:
 *   - 检测 WebGL 支持，不支持则降级为 2D 雷达图
 *   - 管理选中节点状态
 *   - 传递 snapshot 给 3D 场景
 */

interface SkillGraph3DProps {
  snapshot: GraphSnapshot;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  showCoverage?: boolean;
  compact?: boolean;
  onNodeAgentDrop?: (agentKey: string, nodeId: string) => void;
  agentCoverageMap?: Record<string, string[]>;
  compareSnapshot?: GraphSnapshot;
}

/**
 * 检测浏览器是否支持 WebGL
 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * 2D 雷达图降级方案 — 当 WebGL 不可用时显示
 */
function FallbackRadarView({ snapshot }: { snapshot: GraphSnapshot }) {
  const { metrics } = snapshot;
  const data = [
    { label: '综合', value: metrics.overallScore },
    { label: '匹配', value: metrics.matchScore },
    { label: '深度', value: metrics.depthScore },
    { label: '广度', value: metrics.breadthScore },
    { label: '均衡', value: metrics.balanceScore },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full rounded-xl bg-[#0a0a0f] p-6">
      <p className="text-amber-400 text-sm mb-4">
        您的浏览器不支持 WebGL，已降级为 2D 视图
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {data.map((d) => (
          <div
            key={d.label}
            className="bg-white/5 rounded-lg p-3 flex flex-col items-center"
          >
            <span className="text-gray-400 text-xs">{d.label}</span>
            <span className="text-white text-2xl font-bold">{d.value}</span>
            <span className="text-gray-500 text-xs">/100</span>
          </div>
        ))}
      </div>
      <div className="mt-6 text-gray-500 text-xs">
        共 {snapshot.nodes.length} 个技能节点，{snapshot.edges.length} 条关联
      </div>
    </div>
  );
}

export default function SkillGraph3D({
  snapshot,
  onNodeClick,
  selectedNodeId: controlledSelectedId,
  compact = false,
  onNodeAgentDrop,
  agentCoverageMap,
  compareSnapshot,
}: SkillGraph3DProps) {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null
  );

  // 受控/非受控兼容
  const selectedNodeId =
    controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  // WebGL 检测（仅客户端）
  useEffect(() => {
    setWebglSupported(detectWebGL());
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setInternalSelectedId(nodeId);
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  // 加载中
  if (webglSupported === null) {
    return (
      <div className="flex items-center justify-center h-full w-full rounded-xl bg-[#0a0a0f]">
        <div className="animate-pulse text-gray-500 text-sm">正在初始化图表...</div>
      </div>
    );
  }

  // WebGL 不可用 → 降级
  if (!webglSupported) {
    return <FallbackRadarView snapshot={snapshot} />;
  }

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden bg-[#0a0a0f]">
      <SkillGraphScene
        snapshot={snapshot}
        selectedNodeId={selectedNodeId}
        onNodeClick={handleNodeClick}
        onNodeAgentDrop={onNodeAgentDrop}
        agentCoverageMap={agentCoverageMap}
        compareSnapshot={compareSnapshot}
        compact={compact}
      />
    </div>
  );
}
