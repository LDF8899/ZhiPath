import { useCallback, useRef } from 'react';
import type { GraphDelta } from '../types/workspace';

/**
 * 图表增量动画控制器
 * 依赖: npm install @react-spring/three
 *
 * 动画效果:
 *   1. 变化节点: scale 1 → 1.3 → 1 (600ms)
 *   2. 新边: opacity 0 → target (800ms, 延迟 400ms)
 *   3. 新节点: scale 0 → 1 (500ms, 廷迟 200ms)
 *
 * 限制: 仅对最近变化的 10 个节点做动画（性能优化）
 */

interface AnimationState {
  /** 当前正在动画中的节点 ID → 缩放倍率 */
  nodeScales: Map<string, number>;
  /** 当前正在动画中的边 → 透明度 */
  edgeOpacities: Map<string, number>;
  /** 动画是否正在进行 */
  isAnimating: boolean;
}

interface UseGraphAnimationReturn {
  /** 触发增量动画 */
  animateDelta: (delta: GraphDelta) => void;
  /** 获取节点当前缩放 (1.0 = 正常) */
  getNodeScale: (nodeId: string) => number;
  /** 获取边当前透明度 (1.0 = 完全可见) */
  getEdgeOpacity: (from: string, to: string) => number;
  /** 动画是否正在进行 */
  isAnimating: boolean;
}

const MAX_ANIMATED_NODES = 10;
const PULSE_DURATION = 600; // ms
const EDGE_FADE_DURATION = 800;
const EDGE_FADE_DELAY = 400;
const NODE_POP_DURATION = 500;
const NODE_POP_DELAY = 200;

/**
 * 构建边的唯一标识键
 */
function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * 简易 easing: ease-out-cubic
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 在浏览器中执行关键帧动画，通过回调更新状态
 * 返回一个 cancel 函数
 */
function runKeyframes(
  duration: number,
  onFrame: (progress: number) => void,
  onComplete?: () => void,
  delay = 0
): () => void {
  let rafId: number;
  let startTime: number | null = null;
  let cancelled = false;

  const tick = (timestamp: number) => {
    if (cancelled) return;
    if (startTime === null) startTime = timestamp;

    const elapsed = timestamp - startTime - delay;
    if (elapsed < 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const raw = Math.min(elapsed / duration, 1);
    onFrame(easeOutCubic(raw));

    if (raw < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

export default function useGraphAnimation(): UseGraphAnimationReturn {
  const stateRef = useRef<AnimationState>({
    nodeScales: new Map(),
    edgeOpacities: new Map(),
    isAnimating: false,
  });
  const cancelFnsRef = useRef<Array<() => void>>([]);

  const animateDelta = useCallback((delta: GraphDelta) => {
    const state = stateRef.current;

    // 取消上一轮动画
    cancelFnsRef.current.forEach((cancel) => cancel());
    cancelFnsRef.current = [];

    state.isAnimating = true;
    state.nodeScales.clear();
    state.edgeOpacities.clear();

    // 1) 变化节点脉冲动画 (限制前 10 个)
    const changedNodeIds = delta.nodeChanges
      .map((c) => c.nodeId)
      .slice(0, MAX_ANIMATED_NODES);

    for (const nodeId of changedNodeIds) {
      // 脉冲: 1 → 1.3 → 1
      const cancel = runKeyframes(
        PULSE_DURATION,
        (progress) => {
          // 前半段放大，后半段缩小
          const scale = progress < 0.5
            ? 1 + 0.3 * (progress * 2)
            : 1.3 - 0.3 * ((progress - 0.5) * 2);
          state.nodeScales.set(nodeId, scale);
        },
        () => {
          state.nodeScales.delete(nodeId);
          checkAnimationDone(state);
        }
      );
      cancelFnsRef.current.push(cancel);
    }

    // 2) 新节点弹入动画
    for (const nodeId of delta.newNodes) {
      state.nodeScales.set(nodeId, 0);
      const cancel = runKeyframes(
        NODE_POP_DURATION,
        (progress) => {
          state.nodeScales.set(nodeId, progress);
        },
        () => {
          state.nodeScales.delete(nodeId);
          checkAnimationDone(state);
        },
        NODE_POP_DELAY
      );
      cancelFnsRef.current.push(cancel);
    }

    // 3) 新边淡入动画
    for (const edge of delta.newEdges) {
      const key = edgeKey(edge.from, edge.to);
      state.edgeOpacities.set(key, 0);
      const cancel = runKeyframes(
        EDGE_FADE_DURATION,
        (progress) => {
          state.edgeOpacities.set(key, progress * edge.strength);
        },
        () => {
          state.edgeOpacities.delete(key);
          checkAnimationDone(state);
        },
        EDGE_FADE_DELAY
      );
      cancelFnsRef.current.push(cancel);
    }

    // 如果没有任何动画需要执行
    if (cancelFnsRef.current.length === 0) {
      state.isAnimating = false;
    }
  }, []);

  const getNodeScale = useCallback((nodeId: string): number => {
    return stateRef.current.nodeScales.get(nodeId) ?? 1;
  }, []);

  const getEdgeOpacity = useCallback((from: string, to: string): number => {
    const key = edgeKey(from, to);
    // 如果边在动画中返回动画值，否则返回 -1 表示使用默认
    return stateRef.current.edgeOpacities.get(key) ?? -1;
  }, []);

  return {
    animateDelta,
    getNodeScale,
    getEdgeOpacity,
    isAnimating: stateRef.current.isAnimating,
  };
}

function checkAnimationDone(state: AnimationState) {
  if (state.nodeScales.size === 0 && state.edgeOpacities.size === 0) {
    state.isAnimating = false;
  }
}
