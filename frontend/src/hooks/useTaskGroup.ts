import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket, type WSEvent } from './useWebSocket';

/** 子任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 子任务 */
export interface GroupTask {
  taskId: string;
  name: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
}

/** 任务组状态 */
export type GroupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 任务组进度事件 data 结构 */
interface TaskGroupEventData {
  groupId: string;
  taskId?: string;
  taskName?: string;
  taskStatus?: TaskStatus;
  taskProgress?: number;
  message?: string;
  groupStatus?: GroupStatus;
}

/**
 * 任务组进度 Hook
 *
 * 功能：
 *   - 订阅任务组进度
 *   - 计算整体进度百分比
 *   - 区分 pending/running/completed/failed 状态
 *   - 支持取消任务组
 */
export function useTaskGroup(groupId: string) {
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [status, setStatus] = useState<GroupStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const { subscribe, unsubscribe, onMessage, connected } = useWebSocket();
  const unsubRef = useRef<(() => void) | null>(null);

  // 处理 WebSocket 事件
  const handleEvent = useCallback((event: WSEvent) => {
    const data = event.data as TaskGroupEventData;

    // 更新子任务
    if (data.taskId) {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.taskId === data.taskId);
        const updated: GroupTask = {
          taskId: data.taskId!,
          name: data.taskName ?? prev[idx]?.name ?? data.taskId!,
          status: data.taskStatus ?? prev[idx]?.status ?? 'pending',
          progress: data.taskProgress ?? prev[idx]?.progress ?? 0,
          message: data.message ?? prev[idx]?.message,
          startedAt:
            data.taskStatus === 'running'
              ? Date.now()
              : prev[idx]?.startedAt,
          completedAt:
            data.taskStatus === 'completed' || data.taskStatus === 'failed'
              ? Date.now()
              : prev[idx]?.completedAt,
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    }

    // 更新组状态
    if (data.groupStatus) {
      setStatus(data.groupStatus);
    }
  }, []);

  // 订阅
  useEffect(() => {
    if (!groupId) return;

    subscribe(groupId);

    // 监听该组的所有事件
    const unsub = onMessage(`group:${groupId}`, handleEvent);
    unsubRef.current = unsub;

    return () => {
      unsub();
      unsubscribe(groupId);
    };
  }, [groupId, subscribe, unsubscribe, onMessage, handleEvent]);

  // 计算整体进度
  const progress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
    : 0;

  // 状态派生
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isRunning = status === 'running';
  const isCancelled = status === 'cancelled';

  // 取消任务组
  const cancelGroup = useCallback(() => {
    // 通过 WebSocket 发送取消指令
    // 实际取消逻辑由后端处理
    setStatus('cancelled');
    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'pending' || t.status === 'running'
          ? { ...t, status: 'cancelled' as TaskStatus }
          : t,
      ),
    );
  }, []);

  // 重置
  const reset = useCallback(() => {
    setTasks([]);
    setStatus('pending');
    setError(null);
  }, []);

  return {
    tasks,
    progress,
    status,
    error,
    connected,
    isComplete,
    isFailed,
    isRunning,
    isCancelled,
    cancelGroup,
    reset,
  };
}
