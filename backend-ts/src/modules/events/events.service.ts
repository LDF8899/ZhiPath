import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

/** 缓存的事件条目 */
interface CachedEvent {
  type: string;
  data: any;
  timestamp: number;
  userId: number;
}

/** 批量任务信息 */
interface TaskInfo {
  taskId: number | string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  message?: string;
}

/** 单个连接的追踪信息 */
interface ConnectionInfo {
  connectedAt: number;
  lastActivityAt: number;
  eventsSent: number;
}

/** 连接统计快照 */
interface ConnectionStats {
  totalConnections: number;
  activeUsers: number;
  totalEventsSent: number;
  totalEventsCached: number;
  connectionDetails: Array<{ userId: number } & ConnectionInfo>;
  heartbeatActive: boolean;
}

/**
 * SSE 事件服务 — 用户事件流管理
 *
 * 功能：
 *   - 管理用户 SSE 连接
 *   - 发送任务进度事件
 *   - 发送资源生成完成事件
 *   - 发送匹配度变化事件
 *   - 任务组进度推送 / 批量任务状态
 *   - 事件历史缓存（断连重放）
 *   - 心跳检测与死连接清理
 *   - 连接统计
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);

  /** 事件历史缓存上限 */
  private static readonly MAX_HISTORY_SIZE = 50;

  /** 心跳检测间隔（ms） */
  private static readonly HEARTBEAT_INTERVAL_MS = 30_000;

  /** 每个用户的事件缓存 Map<userId, CachedEvent[]> */
  private eventHistory = new Map<string, CachedEvent[]>();

  /** 每个用户的连接追踪信息 */
  private connectionInfo = new Map<string, ConnectionInfo>();

  /** 事件发送总计数 */
  private totalEventsSent = 0;

  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** 用户事件流 Map<userId, Subject> */
  private userStreams = new Map<string, Set<Subject<any>>>();

  private scopeKey(userId: number, tenantId = 1): string {
    return tenantId === 1 ? String(userId) : `${tenantId}:${userId}`;
  }

  private parseScopeKey(key: string): { userId: number; tenantId: number } {
    const [tenant, user] = key.includes(':') ? key.split(':', 2) : ['1', key];
    return { tenantId: Number(tenant) || 1, userId: Number(user) };
  }

  /**
   * 获取用户的 SSE 事件流
   */
  getEventStream(userId: number, tenantId = 1): Observable<any> {
    const key = this.scopeKey(userId, tenantId);
    const subject = new Subject<any>();
    let streams = this.userStreams.get(key);
    if (!streams) {
      streams = new Set<Subject<any>>();
      this.userStreams.set(key, streams);
      this.connectionInfo.set(key, {
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
        eventsSent: 0,
      });
    }
    streams.add(subject);

    const info = this.connectionInfo.get(key);
    if (info) info.lastActivityAt = Date.now();

    Promise.resolve().then(() => this.replayHistory(userId, tenantId, subject));

    return new Observable<any>((subscriber) => {
      const subscription = subject.asObservable().subscribe(subscriber);
      return () => {
        subscription.unsubscribe();
        subject.complete();
        this.removeConnection(userId, tenantId, subject);
      };
    });
  }

  /**
   * 发送事件给用户
   */
  emit(userId: number, event: { type: string; data: any }, tenantId = 1) {
    const key = this.scopeKey(userId, tenantId);
    const subjects = this.userStreams.get(key);
    if (subjects && subjects.size > 0) {
      const timestamped = { ...event, timestamp: Date.now() };
      for (const subject of subjects) {
        subject.next(timestamped);
      }
      this.totalEventsSent++;
      const info = this.connectionInfo.get(key);
      if (info) {
        info.eventsSent++;
        info.lastActivityAt = Date.now();
      }
      if (event.type !== 'heartbeat') {
        this.cacheEvent(userId, tenantId, timestamped);
      }
    }
  }

  private emitScoped(userId: number, event: { type: string; data: any }, tenantId = 1) {
    // Keep the legacy two-argument call shape for the default tenant while
    // making non-default tenant streams explicitly scoped.
    if (tenantId === 1) this.emit(userId, event);
    else this.emit(userId, event, tenantId);
  }

  /**
   * 发送任务进度事件（通用）
   */
  emitProgress(userId: number, taskId: number, progress: number, message?: string, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'task_progress',
      data: { taskId, progress, message },
    }, tenantId);
  }

  /**
   * §23.3 Agent 任务进度事件 — 智能体办公室实时进度
   */
  emitAgentProgress(userId: number, agent: string, taskId: string, progress: number, message?: string, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'agent_progress',
      data: { agent, task_id: taskId, progress, message },
    }, tenantId);
  }

  /**
   * §23.3 Agent 状态变化事件（idle/working/error）
   */
  emitAgentStatus(userId: number, agent: string, status: 'idle' | 'working' | 'error', message?: string, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'agent_status',
      data: { agent, status, message },
    }, tenantId);
  }

  /**
   * §23.3 资源生成完成事件 — 携带技能名与资源类型
   */
  emitResourceReady(userId: number, skillName: string, contentType: 'lecture' | 'quiz' | 'coding' | 'reading' | string, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'resource_ready',
      data: { skill_name: skillName, content_type: contentType },
    }, tenantId);
  }

  /**
   * 发送匹配度变化事件（P0-3：携带可读变化原因，供首页 toast 展示）
   */
  emitMatchUpdate(userId: number, jobId: number, newScore: number, reason?: string, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'match_update',
      data: { jobId, newScore, ...(reason ? { reason } : {}) },
    }, tenantId);
  }

  /**
   * 发送通知事件
   */
  emitNotification(userId: number, notification: { id: number; title: string; type: string }, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'notification',
      data: notification,
    }, tenantId);
  }

  /**
   * §3D图谱 技能/画像更新事件 — 携带增量快照与匹配度
   */
  emitProfileUpdate(userId: number, data: {
    skillName: string;
    delta: any;         // GraphDelta（增删改的节点/边）
    snapshot: any;      // GraphSnapshot（完整快照）
    newMatchScore: number;
  }, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'profile_updated',
      data,
    }, tenantId);
  }

  /**
   * §Agent绑定 学习路径 Agent 建议事件
   */
  emitAgentAdvice(userId: number, data: {
    agentType: string;
    planId: string;
    advice: string;
    skillName?: string;
  }, tenantId = 1) {
    this.emitScoped(userId, {
      type: 'agent_advice',
      data,
    }, tenantId);
  }

  /**
   * 关闭用户事件流
   */
  closeStream(userId: number, tenantId = 1) {
    const key = this.scopeKey(userId, tenantId);
    const subjects = this.userStreams.get(key);
    if (subjects) {
      for (const subject of subjects) {
        subject.complete();
      }
      this.userStreams.delete(key);
      this.connectionInfo.delete(key);
    }
  }

  /**
   * 获取当前连接数
   */
  get connectedUsers(): number {
    return this.userStreams.size;
  }

  // ──────────────────────────────────────────────
  //  事件历史缓存
  // ──────────────────────────────────────────────

  /**
   * 缓存事件到用户历史队列（FIFO，上限 MAX_HISTORY_SIZE）
   */
  private cacheEvent(userId: number, tenantId: number, event: { type: string; data: any; timestamp: number }) {
    const key = this.scopeKey(userId, tenantId);
    let history = this.eventHistory.get(key);
    if (!history) {
      history = [];
      this.eventHistory.set(key, history);
    }
    history.push({ ...event, userId });
    // 超出上限时淘汰最旧的
    while (history.length > EventsService.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * 重放缓存事件给指定用户（新连接建立时调用）
   */
  private replayHistory(userId: number, tenantId = 1, targetSubject?: Subject<any>) {
    const key = this.scopeKey(userId, tenantId);
    const history = this.eventHistory.get(key);
    if (!history || history.length === 0) return;

    const subject = targetSubject || Array.from(this.userStreams.get(key) || [])[0];
    if (!subject) return;

    for (const event of history) {
      subject.next({
        type: event.type,
        data: event.data,
        timestamp: event.timestamp,
        replayed: true,
      });
    }
    this.logger.debug(`Replayed ${history.length} cached events to user ${userId}`);
  }

  /**
   * 清除指定用户的事件缓存
   */
  clearHistory(userId: number, tenantId = 1) {
    this.eventHistory.delete(this.scopeKey(userId, tenantId));
  }

  // ──────────────────────────────────────────────
  //  1. 任务组进度推送
  // ──────────────────────────────────────────────

  /**
   * 推送任务组整体进度
   * @param userId    目标用户
   * @param groupId   任务组 ID
   * @param progress  整体进度 0-100
   * @param message   可选描述
   * @param taskIds   组内任务 ID 列表（可选）
   */
  emitGroupProgress(
    userId: number,
    groupId: string,
    progress: number,
    message?: string,
    taskIds?: Array<number | string>,
    tenantId = 1,
  ) {
    this.emitScoped(userId, {
      type: 'group_progress',
      data: {
        groupId,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        taskIds,
        completed: progress >= 100,
      },
    }, tenantId);
  }

  // ──────────────────────────────────────────────
  //  2. 批量任务状态推送
  // ──────────────────────────────────────────────

  /**
   * 批量推送多个任务状态（一次事件携带所有任务，减少 SSE 帧数）
   * @param userId  目标用户
   * @param tasks   任务信息数组
   */
  emitBatchTaskUpdate(userId: number, tasks: TaskInfo[], tenantId = 1) {
    this.emitScoped(userId, {
      type: 'batch_task_update',
      data: {
        tasks,
        count: tasks.length,
      },
    }, tenantId);
  }

  // ──────────────────────────────────────────────
  //  3. 连接管理增强
  // ──────────────────────────────────────────────

  /**
   * 获取连接统计快照
   */
  getConnectionStats(): ConnectionStats {
    const connectionDetails: Array<{ userId: number } & ConnectionInfo> = [];
    for (const [key, info] of this.connectionInfo) {
      connectionDetails.push({ userId: this.parseScopeKey(key).userId, ...info });
    }
    return {
      totalConnections: this.userStreams.size,
      activeUsers: this.userStreams.size,
      totalEventsSent: this.totalEventsSent,
      totalEventsCached: Array.from(this.eventHistory.values())
        .reduce((sum, h) => sum + h.length, 0),
      connectionDetails,
      heartbeatActive: this.heartbeatTimer !== null,
    };
  }

  /**
   * 检查指定用户是否在线
   */
  isUserOnline(userId: number, tenantId = 1): boolean {
    return this.userStreams.has(this.scopeKey(userId, tenantId));
  }

  /**
   * 获取所有在线用户 ID 列表
   */
  getOnlineUserIds(): number[] {
    return Array.from(this.userStreams.keys()).map((key) => this.parseScopeKey(key).userId);
  }

  // ──────────────────────────────────────────────
  //  5. 心跳检测
  // ──────────────────────────────────────────────

  /**
   * 启动心跳检测（模块初始化时自动调用）
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(
      () => this.checkConnections(),
      EventsService.HEARTBEAT_INTERVAL_MS,
    );
    this.logger.log(`Heartbeat started (interval=${EventsService.HEARTBEAT_INTERVAL_MS}ms)`);
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.log('Heartbeat stopped');
    }
  }

  /**
   * 心跳检测：向所有连接发送 heartbeat，失败则清理
   */
  private checkConnections() {
    const now = Date.now();
    const deadScopes: string[] = [];

    for (const [scopeKey, subjects] of this.userStreams) {
      for (const subject of subjects) {
        try {
          subject.next({
            type: 'heartbeat',
            data: { ts: now },
            timestamp: now,
          });
        } catch {
          subjects.delete(subject);
        }
      }
      if (subjects.size === 0) {
        deadScopes.push(scopeKey);
      }
    }

    for (const scopeKey of deadScopes) {
      const { userId, tenantId } = this.parseScopeKey(scopeKey);
      this.closeStream(userId, tenantId);
    }

    if (deadScopes.length > 0) {
      this.logger.warn(`Heartbeat: cleaned ${deadScopes.length} dead connection(s)`);
    }
  }

  /**
   * 关闭所有连接并清理资源（模块销毁时调用）
   */
  closeAllStreams() {
    for (const [, subjects] of this.userStreams) {
      for (const subject of subjects) {
        try {
          subject.complete();
        } catch {
          // ignore already closed subjects
        }
      }
    }
    this.userStreams.clear();
    this.connectionInfo.clear();
    this.logger.log('All streams closed');
  }

  /**
   * 清理过期的事件缓存（可选：定时调用以释放内存）
   * @param maxAgeMs  缓存最大存活时间（ms），默认 10 分钟
   */
  pruneStaleHistory(maxAgeMs = 10 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [scopeKey, history] of this.eventHistory) {
      const filtered = history.filter((e) => e.timestamp > cutoff);
      if (filtered.length === 0) {
        this.eventHistory.delete(scopeKey);
        pruned += history.length;
      } else if (filtered.length < history.length) {
        pruned += history.length - filtered.length;
        this.eventHistory.set(scopeKey, filtered);
      }
    }
    if (pruned > 0) {
      this.logger.debug(`Pruned ${pruned} stale cached event(s)`);
    }
  }

  // ──────────────────────────────────────────────
  //  生命周期钩子
  // ──────────────────────────────────────────────

  private removeConnection(userId: number, tenantId: number, subject: Subject<any>) {
    const key = this.scopeKey(userId, tenantId);
    const subjects = this.userStreams.get(key);
    if (!subjects) return;
    subjects.delete(subject);
    if (subjects.size === 0) {
      this.userStreams.delete(key);
      this.connectionInfo.delete(key);
    }
  }

  onModuleInit() {
    this.startHeartbeat();
  }

  onModuleDestroy() {
    this.stopHeartbeat();
    this.closeAllStreams();
  }
}
