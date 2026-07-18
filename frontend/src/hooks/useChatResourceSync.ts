import { useCallback, useEffect, useRef } from 'react';
import { useSSE } from './useSSE';
import { useChatStore } from '../stores/chat';
import {
  actionsFromResourceReadyEvent,
  reconcileChatAgentTasks,
  reconcileGeneratedResources,
  upsertActionsIntoSession,
} from '../utils/chatResources';

export function useChatResourceSync() {
  const { latestEvent } = useSSE();
  const processedRef = useRef(new Set<string>());
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReconcile = useCallback((delay = 500) => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      reconcileGeneratedResources()
        .then(() => reconcileChatAgentTasks())
        .catch(() => {});
    }, delay);
  }, []);

  useEffect(() => {
    scheduleReconcile(800);
    const timer = setInterval(() => {
      reconcileGeneratedResources()
        .then(() => reconcileChatAgentTasks())
        .catch(() => {});
    }, 15000);
    return () => {
      clearInterval(timer);
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    };
  }, [scheduleReconcile]);

  useEffect(() => {
    if (!latestEvent) return;

    const eventKey = `${latestEvent.type}:${latestEvent.data?.task_id || latestEvent.data?.taskId || ''}:${latestEvent.data?.skill_name || latestEvent.data?.skillName || ''}:${latestEvent.data?.content_type || latestEvent.data?.contentType || ''}:${latestEvent.timestamp || ''}`;
    if (processedRef.current.has(eventKey)) return;
    processedRef.current.add(eventKey);
    if (processedRef.current.size > 200) {
      processedRef.current = new Set([...processedRef.current].slice(-100));
    }

    if (latestEvent.type === 'resource_ready') {
      scheduleReconcile(200);
      actionsFromResourceReadyEvent(latestEvent.data)
        .then((actions) => {
          const sessionId =
            latestEvent.data?._chatSessionId ||
            latestEvent.data?.chatSessionId ||
            useChatStore.getState().currentSessionId;
          if (sessionId && actions.length > 0) {
            upsertActionsIntoSession(sessionId, actions);
          }
        })
        .catch(() => {});
      return;
    }

    if (latestEvent.type === 'agent_status') {
      scheduleReconcile(latestEvent.data?.status === 'idle' || latestEvent.data?.status === 'error' ? 200 : 1000);
      return;
    }

    if (latestEvent.type === 'agent_progress') {
      const progress = Number(latestEvent.data?.progress);
      if (progress >= 100 || progress < 0) {
        scheduleReconcile(200);
      } else {
        scheduleReconcile(1500);
      }
    }
  }, [latestEvent, scheduleReconcile]);
}
