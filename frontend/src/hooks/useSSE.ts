import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';

interface SSEOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnects?: number;
}

interface SSEEvent {
  type: string;
  data: any;
  timestamp?: number;
}

interface SseSnapshot {
  connected: boolean;
  events: SSEEvent[];
  error: string | null;
}

const subscribers = new Set<() => void>();
let source: EventSource | null = null;
let sourceToken: string | null = null;
let connected = false;
let error: string | null = null;
let events: SSEEvent[] = [];
let reconnectCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectIntervalMs = 5000;
let reconnectLimit = 10;

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    useAuthStore.getState().token ||
    sessionStorage.getItem('zhpath_token') ||
    sessionStorage.getItem('token')
  );
}

function snapshot(): SseSnapshot {
  return { connected, events, error };
}

function notify() {
  for (const subscriber of subscribers) subscriber();
}

function closeSharedConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (source) {
    source.close();
    source = null;
  }
  connected = false;
}

function openSharedConnection(token: string | null, options: Required<SSEOptions>) {
  reconnectIntervalMs = options.reconnectInterval;
  reconnectLimit = options.maxReconnects;

  if (!token) {
    closeSharedConnection();
    sourceToken = null;
    error = null;
    notify();
    return;
  }

  if (source && sourceToken === token) return;

  closeSharedConnection();
  sourceToken = token;

  const eventSource = new EventSource(`/api/user/events/stream?token=${encodeURIComponent(token)}`);

  eventSource.onopen = () => {
    reconnectCount = 0;
    connected = true;
    error = null;
    notify();
  };

  eventSource.onmessage = (event) => {
    try {
      events = [...events.slice(-99), JSON.parse(event.data)];
      notify();
    } catch {
      // Ignore malformed server-sent event payloads.
    }
  };

  eventSource.onerror = () => {
    connected = false;
    eventSource.close();
    if (source === eventSource) source = null;
    notify();

    if (subscribers.size > 0 && reconnectCount < reconnectLimit) {
      reconnectCount++;
      reconnectTimer = setTimeout(() => {
        openSharedConnection(readToken(), {
          autoConnect: true,
          reconnectInterval: reconnectIntervalMs,
          maxReconnects: reconnectLimit,
        });
      }, reconnectIntervalMs);
    } else {
      error = '连接失败，请刷新页面重试';
      notify();
    }
  };

  source = eventSource;
}

export function useSSE(options: SSEOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnects = 10,
  } = options;
  const authToken = useAuthStore((state) => state.token);
  const [state, setState] = useState<SseSnapshot>(() => snapshot());

  const connect = useCallback(() => {
    openSharedConnection(readToken(), { autoConnect, reconnectInterval, maxReconnects });
  }, [autoConnect, reconnectInterval, maxReconnects]);

  const disconnect = useCallback(() => {
    closeSharedConnection();
    notify();
  }, []);

  useEffect(() => {
    const update = () => setState(snapshot());
    subscribers.add(update);
    update();

    if (autoConnect) connect();

    return () => {
      subscribers.delete(update);
      if (subscribers.size === 0) {
        closeSharedConnection();
      }
    };
  }, [autoConnect, authToken, connect]);

  const clearEvents = useCallback(() => {
    events = [];
    notify();
  }, []);

  const latestEvent = state.events.length > 0 ? state.events[state.events.length - 1] : null;

  const getEventsByType = useCallback((type: string) => (
    state.events.filter((event) => event.type === type)
  ), [state.events]);

  return {
    connected: state.connected,
    events: state.events,
    latestEvent,
    error: state.error,
    connect,
    disconnect,
    clearEvents,
    getEventsByType,
  };
}
