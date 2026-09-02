/**
 * SSE 实时通道
 *
 * 后端 GET /api/user/events/stream 的 AuthGuard 同时支持
 * Authorization 头和 ?token= 查询参数；原生 EventSource 不能自定义请求头，
 * 所以这里沿用 query 传 token 的方式。
 *
 * 全局只维护一条连接，页面通过 subscribe 订阅，避免多页重复建连。
 */

import { useEffect, useState } from 'react';
import { getToken } from './api';

export type StreamEvent = {
  type: string;
  data: any;
  timestamp?: number;
  replayed?: boolean;
};

/** 后端已实现的事件类型（events.service.ts） */
export const EVENT_TYPES = {
  CONNECTED: 'connected',
  CHAT_THINKING: 'chat_thinking',
  CHAT_DONE: 'chat_done',
  TASK_PROGRESS: 'task_progress',
  AGENT_PROGRESS: 'agent_progress',
  AGENT_STATUS: 'agent_status',
  RESOURCE_READY: 'resource_ready',
  MATCH_UPDATE: 'match_update',
  NOTIFICATION: 'notification',
  PROFILE_UPDATED: 'profile_updated',
  AGENT_ADVICE: 'agent_advice',
  GROUP_PROGRESS: 'group_progress',
  BATCH_TASK_UPDATE: 'batch_task_update',
  COMMIT_CREATED: 'commit_created',
  BRANCH_UPDATED: 'branch_updated',
  EVALUATION_UPDATED: 'evaluation_updated',
  HEARTBEAT: 'heartbeat',
} as const;

type Listener = (event: StreamEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let sourceToken: string | null = null;
let connected = false;
let reconnectCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_RECONNECTS = 10;
const RECONNECT_INTERVAL = 4000;

function notify(event: StreamEvent) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // 单个订阅者出错不影响其他订阅者
    }
  }
}

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  window.dispatchEvent(new CustomEvent('codenova:sse-status', { detail: next }));
}

function close() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (source) {
    source.close();
    source = null;
  }
  sourceToken = null;
  setConnected(false);
}

function open() {
  const token = getToken();
  if (!token) {
    close();
    return;
  }
  if (source && sourceToken === token) return;

  close();
  sourceToken = token;

  const es = new EventSource(`/api/user/events/stream?token=${encodeURIComponent(token)}`);

  es.onopen = () => {
    reconnectCount = 0;
    setConnected(true);
  };

  es.onmessage = (message) => {
    try {
      notify(JSON.parse(message.data));
    } catch {
      // 忽略无法解析的心跳或空帧
    }
  };

  es.onerror = () => {
    setConnected(false);
    es.close();
    if (source === es) source = null;

    if (listeners.size > 0 && reconnectCount < MAX_RECONNECTS && getToken()) {
      reconnectCount += 1;
      reconnectTimer = setTimeout(open, RECONNECT_INTERVAL);
    }
  };

  source = es;
}

/** 订阅全局 SSE 事件流；返回取消订阅函数 */
export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      close();
    }
  };
}

/** 在组件中监听指定类型的事件 */
export function useStreamEvents(
  types: string | string[],
  handler: (event: StreamEvent) => void,
) {
  const wanted = Array.isArray(types) ? types : [types];
  // 用 ref 固化回调，避免父组件每次渲染都重建订阅
  const handlerRef = { current: handler };
  handlerRef.current = handler;

  useEffect(() => {
    const set = new Set(wanted);
    return subscribeEvents((event) => {
      if (set.has(event.type)) handlerRef.current(event);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join('|')]);
}

/** SSE 连接状态指示 */
export function useStreamStatus(): boolean {
  const [online, setOnline] = useState(connected);

  useEffect(() => {
    const sync = () => setOnline(connected);
    const onCustom = (event: Event) => setOnline((event as CustomEvent).detail === true);
    sync();
    window.addEventListener('codenova:sse-status', onCustom);
    return () => window.removeEventListener('codenova:sse-status', onCustom);
  }, []);

  return online;
}

/** 页面卸载或退出登录时手动断开 */
export function disconnectStream() {
  listeners.clear();
  close();
}
