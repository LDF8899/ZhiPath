import { useEffect, useRef, useCallback, useState } from 'react';
import { startSession, endSession, recordSessionProgress } from '../api/user';

const SESSION_KEY = 'zhpath_learning_session_id';

/**
 * 学习会话 Hook — 自动管理会话生命周期
 *
 * sessionId 持久化到 sessionStorage，跨页面导航复用同一个会话。
 *
 * 进入学习页 → startSession（如果还没有活跃会话）
 * 学习中 → recordProgress
 * 退出/切页 → endSession（beforeunload + unmount）
 */
export function useSession(planId?: number) {
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? parseInt(stored, 10) : null;
  });
  const endingRef = useRef(false);

  const doStart = useCallback(async () => {
    if (sessionId) return;
    try {
      const res = await startSession(planId);
      if (res.data?.id) {
        sessionStorage.setItem(SESSION_KEY, String(res.data.id));
        setSessionId(res.data.id);
      }
    } catch {}
  }, [planId, sessionId]);

  const doEnd = useCallback(async () => {
    const id = sessionId ?? parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10);
    if (!id || endingRef.current) return;
    endingRef.current = true;
    try {
      await endSession(id);
    } catch {}
    sessionStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    endingRef.current = false;
  }, [sessionId]);

  const recordProgress = useCallback(async (
    taskId: number,
    skillName: string,
    masteryBefore: number,
    masteryAfter: number,
  ) => {
    const id = sessionId ?? parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10);
    if (!id) return;
    try {
      await recordSessionProgress(id, { taskId, skillName, masteryBefore, masteryAfter });
    } catch {}
  }, [sessionId]);

  // 启动会话
  useEffect(() => {
    doStart();
    // 不在 unmount 时 endSession — 因为页面导航也会触发 unmount
    // endSession 由 beforeunload 或手动调用触发
  }, [doStart]);

  // beforeunload — 关闭标签页/刷新时保存
  useEffect(() => {
    const handler = () => {
      const id = sessionId ?? parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10);
      if (!id) return;
      navigator.sendBeacon(`/api/user/sessions/${id}/end`);
      sessionStorage.removeItem(SESSION_KEY);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionId]);

  return {
    sessionId,
    recordProgress,
    endSession: doEnd,
  };
}

/**
 * 轻量 hook — 仅获取当前会话 ID + recordProgress，不启动/结束会话
 * 用于子页面（如 KnowledgeDetail）复用父页面创建的会话
 */
export function useSessionProgress() {
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  // 监听 sessionStorage 变化（跨标签页不会触发，但同标签页导航时值已存在）
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setSessionId(parseInt(stored, 10));
  }, []);

  const recordProgress = useCallback(async (
    taskId: number,
    skillName: string,
    masteryBefore: number,
    masteryAfter: number,
  ) => {
    const id = sessionId ?? parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10);
    if (!id) return;
    try {
      await recordSessionProgress(id, { taskId, skillName, masteryBefore, masteryAfter });
    } catch {}
  }, [sessionId]);

  return { sessionId, recordProgress };
}
