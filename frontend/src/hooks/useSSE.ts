import { useEffect, useRef, useState, useCallback } from 'react';

interface SSEOptions {
  /** 是否自动连接 */
  autoConnect?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnects?: number;
}

interface SSEEvent {
  type: string;
  data: any;
  timestamp?: number;
}

/**
 * SSE Hook — EventSource 封装 + 自动重连
 */
export function useSSE(options: SSEOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnects = 10,
  } = options;

  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;

  const connect = useCallback(() => {
    if (!token) return;

    // 关闭现有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // EventSource 不支持自定义 header，token 通过 query param 传递
    const url = `/api/user/events/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectCountRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents(prev => [...prev.slice(-99), data]); // 保留最近 100 条
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();

      // 自动重连
      if (reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      } else {
        setError('连接失败，请刷新页面重试');
      }
    };

    eventSourceRef.current = es;
  }, [token, reconnectInterval, maxReconnects]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  /** 清空事件历史 */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /** 获取最新事件 */
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  /** 按类型筛选事件 */
  const getEventsByType = useCallback((type: string) => {
    return events.filter(e => e.type === type);
  }, [events]);

  return {
    connected,
    events,
    latestEvent,
    error,
    connect,
    disconnect,
    clearEvents,
    getEventsByType,
  };
}
