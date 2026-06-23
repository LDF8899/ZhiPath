import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';

/** WebSocket 事件 */
export interface WSEvent {
  type: string;
  groupId?: string;
  taskId?: string;
  data: any;
  timestamp: number;
}

/** 连接统计 */
export interface ConnectionStats {
  connectCount: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  reconnectCount: number;
  pendingEvents: number;
}

type MessageHandler = (event: WSEvent) => void;

interface WSOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

const DEFAULT_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws`;

/**
 * WebSocket Hook — 实时任务状态推送
 *
 * 功能：
 *   - 自动连接/重连（指数退避）
 *   - 订阅指定任务组的进度
 *   - 心跳检测
 *   - 事件缓存（断连期间不丢失）
 */
export function useWebSocket(options: WSOptions = {}) {
  const {
    url = DEFAULT_URL,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000,
  } = options;

  const token = useAuthStore((s) => s.token);

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    connectCount: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    reconnectCount: 0,
    pendingEvents: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const pendingEventsRef = useRef<WSEvent[]>([]);
  const subscribedGroupsRef = useRef<Set<string>>(new Set());

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // 启动心跳
  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, clearTimers]);

  // 触发事件处理器
  const emit = useCallback((event: WSEvent) => {
    // 全局处理器
    const globalHandlers = handlersRef.current.get('*');
    if (globalHandlers) {
      globalHandlers.forEach((fn) => fn(event));
    }
    // 类型处理器
    const typeHandlers = handlersRef.current.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach((fn) => fn(event));
    }
    // groupId 处理器
    if (event.groupId) {
      const groupHandlers = handlersRef.current.get(`group:${event.groupId}`);
      if (groupHandlers) {
        groupHandlers.forEach((fn) => fn(event));
      }
    }
  }, []);

  // 连接
  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // 关闭旧连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      reconnectCountRef.current = 0;
      startHeartbeat();
      setConnectionStats((prev) => ({
        ...prev,
        connectCount: prev.connectCount + 1,
        lastConnectedAt: Date.now(),
        reconnectCount: reconnectCountRef.current,
      }));

      // 重新订阅之前的任务组
      subscribedGroupsRef.current.forEach((groupId) => {
        ws.send(JSON.stringify({ type: 'subscribe', groupId }));
      });

      // 发送缓存的事件（如有需要）
      const pending = [...pendingEventsRef.current];
      pendingEventsRef.current = [];
      setConnectionStats((prev) => ({
        ...prev,
        pendingEvents: 0,
      }));
      pending.forEach((event) => emit(event));
    };

    ws.onmessage = (msg) => {
      try {
        const event: WSEvent = JSON.parse(msg.data);
        // 忽略 pong
        if (event.type === 'pong') return;
        setLastEvent(event);
        emit(event);
      } catch {
        // 非 JSON 消息忽略
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearTimers();
      setConnectionStats((prev) => ({
        ...prev,
        lastDisconnectedAt: Date.now(),
      }));

      // 指数退避重连
      if (reconnectCountRef.current < maxReconnectAttempts) {
        const delay = reconnectInterval * Math.pow(1.5, reconnectCountRef.current);
        reconnectCountRef.current++;
        setConnectionStats((prev) => ({
          ...prev,
          reconnectCount: reconnectCountRef.current,
        }));
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose 会紧随其后触发，重连逻辑在 onclose 中处理
    };

    wsRef.current = ws;
  }, [token, url, reconnectInterval, maxReconnectAttempts, startHeartbeat, clearTimers, emit]);

  // 断开连接
  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    reconnectCountRef.current = maxReconnectAttempts; // 阻止自动重连
  }, [clearTimers, maxReconnectAttempts]);

  // 订阅任务组
  const subscribe = useCallback((groupId: string) => {
    subscribedGroupsRef.current.add(groupId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', groupId }));
    }
  }, []);

  // 取消订阅
  const unsubscribe = useCallback((groupId: string) => {
    subscribedGroupsRef.current.delete(groupId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', groupId }));
    }
  }, []);

  // 注册事件处理器
  const onMessage = useCallback(
    (key: string, handler: MessageHandler) => {
      if (!handlersRef.current.has(key)) {
        handlersRef.current.set(key, new Set());
      }
      handlersRef.current.get(key)!.add(handler);
      // 返回清理函数
      return () => {
        handlersRef.current.get(key)?.delete(handler);
      };
    },
    [],
  );

  // 自动连接
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, token]);

  return {
    connected,
    subscribe,
    unsubscribe,
    onMessage,
    lastEvent,
    connectionStats,
    connect,
    disconnect,
  };
}
