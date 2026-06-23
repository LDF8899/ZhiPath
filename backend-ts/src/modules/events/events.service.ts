import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

/**
 * SSE 事件服务 — 用户事件流管理
 *
 * 功能：
 *   - 管理用户 SSE 连接
 *   - 发送任务进度事件
 *   - 发送资源生成完成事件
 *   - 发送匹配度变化事件
 */
@Injectable()
export class EventsService {
  /** 用户事件流 Map<userId, Subject> */
  private userStreams = new Map<number, Subject<any>>();

  /**
   * 获取用户的 SSE 事件流
   */
  getEventStream(userId: number): Observable<any> {
    if (!this.userStreams.has(userId)) {
      this.userStreams.set(userId, new Subject<any>());
    }
    return this.userStreams.get(userId)!.asObservable();
  }

  /**
   * 发送事件给用户
   */
  emit(userId: number, event: { type: string; data: any }) {
    const subject = this.userStreams.get(userId);
    if (subject) {
      subject.next({
        ...event,
        timestamp: Date.now(),
      });
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
    }
  }

  /**
   * 获取当前连接数
   */
  get connectedUsers(): number {
    return this.userStreams.size;
  }
}
