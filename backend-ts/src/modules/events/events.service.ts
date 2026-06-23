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
  private eventHistory = new Map<number, CachedEvent[]>();

  /** 每个用户的连接追踪信息 */
  private connectionInfo = new Map<number, ConnectionInfo>();

  /** 事件发送总计数 */
  private totalEventsSent = 0;

  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** 用户事件流 Map<userId, Subject> */
  private userStreams = new Map<number, Subject<any>>();

  /**
   * 获取用户的 SSE 事件流
   */
  getEventStream(userId: number): Observable<any> {
    if (!this.userStreams.has(userId)) {
      this.userStreams.set(userId, new Subject<any>());
      this.connectionInfo.set(userId, {
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
        eventsSent: 0,
      });
      // 新连接建立后重放缓存事件（异步，不阻塞 Observable 返回）
      Promise.resolve().then(() => this.replayHistory(userId));
    }
    return this.userStreams.get(userId)!.asObservable();
  }

  /**
   * 发送事件给用户
   */
  emit(userId: number, event: { type: string; data: any }) {
    const subject = this.userStreams.get(userId);
    if (subject) {
      const timestamped = { ...event, timestamp: Date.now() };
      subject.next(timestamped);
      // 更新统计
      this.totalEventsSent++;
      const info = this.connectionInfo.get(userId);
      if (info) {
        info.eventsSent++;
        info.lastActivityAt = Date.now();
      }
      // 缓存事件（跳过心跳事件，避免噪音）
      if (event.type !== 'heartbeat') {
        this.cacheEvent(userId, timestamped);
      }
    }
  }

  /**
   * 发送任务进度事件（通用）
   */
  emitProgress(userId: number, taskId: number, progress: number, message?: string) {
    this.emit(userId, {
      type: 'task_progress',
      data: { taskId, progress, message },
    });
  }

  /**
   * §23.3 Agent 任务进度事件 — 智能体办公室实时进度
   */
  emitAgentProgress(userId: number, agent: string, taskId: string, progress: number, message?: string) {
    this.emit(userId, {
      type: 'agent_progress',
      data: { agent, task_id: taskId, progress, message },
    });
  }

  /**
   * §23.3 Agent 状态变化事件（idle/working/error）
   */
  emitAgentStatus(userId: number, agent: string, status: 'idle' | 'working' | 'error', message?: string) {
    this.emit(userId, {
      type: 'agent_status',
      data: { agent, status, message },
    });
  }

  /**
   * §23.3 资源生成完成事件 — 携带技能名与资源类型
   */
  emitResourceReady(userId: number, skillName: string, contentType: 'lecture' | 'quiz' | 'coding' | 'reading' | string) {
    this.emit(userId, {
      type: 'resource_ready',
      data: { skill_name: skillName, content_type: contentType },
    });
  }

  /**
   * 发送匹配度变化事件
   */
  emitMatchUpdate(userId: number, jobId: number, newScore: number) {
    this.emit(userId, {
      type: 'match_update',
      data: { jobId, newScore },
    });
  }

  /**
   * 发送通知事件
   */
  emitNotification(userId: number, notification: { id: number; title: string; type: string }) {
    this.emit(userId, {
      type: 'notification',
      data: notification,
    });
  }

  /**
   * §3D图谱 技能/画像更新事件 — 携带增量快照与匹配度
   */
  emitProfileUpdate(userId: number, data: {
    skillName: string;
    delta: any;         // GraphDelta（增删改的节点/边）
    snapshot: any;      // GraphSnapshot（完整快照）
    newMatchScore: number;
  }) {
    this.emit(userId, {
      type: 'profile_updated',
      data,
    });
  }

  /**
   * §Agent绑定 学习路径 Agent 建议事件
   */
  emitAgentAdvice(userId: number, data: {
    agentType: string;
    planId: string;
    advice: string;
    skillName?: string;
  }) {
    this.emit(userId, {
      type: 'agent_advice',
      data,
    });
  }

  /**
   * 关闭用户事件流
   */
  closeStream(userId: number) {
    const subject = this.userStreams.get(userId);
    if (subject) {
      subject.complete();
      this.userStreams.delete(userId);
      this.connectionInfo.delete(userId);
      // 保留事件缓存，以便重连后重放
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
  private cacheEvent(userId: number, event: { type: string; data: any; timestamp: number }) {
    let history = this.eventHistory.get(userId);
    if (!history) {
      history = [];
      this.eventHistory.set(userId, history);
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
  private replayHistory(userId: number) {
    const history = this.eventHistory.get(userId);
    if (!history || history.length === 0) return;

    const subject = this.userStreams.get(userId);
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
  clearHistory(userId: number) {
    this.eventHistory.delete(userId);
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
  ) {
    this.emit(userId, {
      type: 'group_progress',
      data: {
        groupId,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        taskIds,
        completed: progress >= 100,
      },
    });
  }

  // ──────────────────────────────────────────────
  //  2. 批量任务状态推送
  // ──────────────────────────────────────────────

  /**
   * 批量推送多个任务状态（一次事件携带所有任务，减少 SSE 帧数）
   * @param userId  目标用户
   * @param tasks   任务信息数组
   */
  emitBatchTaskUpdate(userId: number, tasks: TaskInfo[]) {
    this.emit(userId, {
      type: 'batch_task_update',
      data: {
        tasks,
        count: tasks.length,
      },
    });
  }

  // ──────────────────────────────────────────────
  //  3. 连接管理增强
  // ──────────────────────────────────────────────

  /**
   * 获取连接统计快照
   */
  getConnectionStats(): ConnectionStats {
    const connectionDetails: Array<{ userId: number } & ConnectionInfo> = [];
    for (const [userId, info] of this.connectionInfo) {
      connectionDetails.push({ userId, ...info });
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
  isUserOnline(userId: number): boolean {
    return this.userStreams.has(userId);
  }

  /**
   * 获取所有在线用户 ID 列表
   */
  getOnlineUserIds(): number[] {
    return Array.from(this.userStreams.keys());
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
    const deadUserIds: number[] = [];

    for (const [userId, subject] of this.userStreams) {
      try {
        subject.next({
          type: 'heartbeat',
          data: { ts: now },
          timestamp: now,
        });
      } catch {
        // 发送失败 → 标记为死连接
        deadUserIds.push(userId);
      }
    }

    // 先收集再清理，避免迭代时修改 Map
    for (const userId of deadUserIds) {
      this.closeStream(userId);
    }

    if (deadUserIds.length > 0) {
      this.logger.warn(`Heartbeat: cleaned ${deadUserIds.length} dead connection(s)`);
    }
  }

  /**
   * 关闭所有连接并清理资源（模块销毁时调用）
   */
  closeAllStreams() {
    for (const [userId, subject] of this.userStreams) {
      try {
        subject.complete();
      } catch {
        // 忽略已关闭的 subject
      }
    }
    this.userStreams.clear();
    this.connectionInfo.clear();
    // 保留 eventHistory，以便服务重启后可恢复
    this.logger.log('All streams closed');
  }

  /**
   * 清理过期的事件缓存（可选：定时调用以释放内存）
   * @param maxAgeMs  缓存最大存活时间（ms），默认 10 分钟
   */
  pruneStaleHistory(maxAgeMs = 10 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [userId, history] of this.eventHistory) {
      const filtered = history.filter((e) => e.timestamp > cutoff);
      if (filtered.length === 0) {
        this.eventHistory.delete(userId);
        pruned += history.length;
      } else if (filtered.length < history.length) {
        pruned += history.length - filtered.length;
        this.eventHistory.set(userId, filtered);
      }
    }
    if (pruned > 0) {
      this.logger.debug(`Pruned ${pruned} stale cached event(s)`);
    }
  }

  // ──────────────────────────────────────────────
  //  生命周期钩子
  // ──────────────────────────────────────────────

  onModuleInit() {
    this.startHeartbeat();
  }

  onModuleDestroy() {
    this.stopHeartbeat();
    this.closeAllStreams();
  }
}
