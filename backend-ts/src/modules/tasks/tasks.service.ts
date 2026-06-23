import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../database/redis.module';
import Redis from 'ioredis';

/**
 * Tasks 服务 — 对齐 Python api/user/tasks.py
 * 异步任务状态查询（Redis 存储）
 */
@Injectable()
export class TasksService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async getTask(taskId: string) {
    const raw = await this.redis.get(`task:${taskId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async listTasks(userId: number) {
    const taskIds = await this.redis.lrange(`user_tasks:${userId}`, 0, 49);
    const tasks = [];
    for (const tid of taskIds) {
      const task = await this.getTask(tid);
      if (task) {
        task.task_id = tid;
        tasks.push(task);
      }
    }
    return tasks;
  }
}
