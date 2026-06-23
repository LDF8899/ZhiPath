import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Agent 任务队列表 — agent_tasks_v3
 * 智能体办公室的核心数据结构
 */
@Entity('agent_tasks_v3')
export class AgentTask extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'agent_type',
    comment: 'Agent 类型',
  })
  agentType: string;

  @Column({ type: 'varchar', length: 200, name: 'title', comment: '任务标题' })
  title: string;

  @Column({ type: 'text', nullable: true, name: 'description', comment: '任务描述' })
  description: string;

  @Column({ type: 'json', nullable: true, name: 'params', comment: '任务参数' })
  params: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'success', 'failed', 'cancelled'],
    default: 'pending',
    name: 'task_status',
    comment: '任务状态',
  })
  taskStatus: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

  @Column({ type: 'int', default: 0, name: 'progress', comment: '进度 0-100' })
  progress: number;

  @Column({ type: 'json', nullable: true, name: 'result', comment: '任务结果' })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true, name: 'error_message', comment: '错误信息' })
  errorMessage: string;

  @Column({ type: 'tinyint', default: 0, name: 'is_urgent', comment: '是否紧急' })
  isUrgent: number;

  @Column({ type: 'int', default: 0, name: 'sort_order', comment: '排序' })
  sortOrder: number;

  @Column({ type: 'bigint', nullable: true, name: 'started_at', comment: '开始时间' })
  startedAt: number;

  @Column({ type: 'bigint', nullable: true, name: 'completed_at', comment: '完成时间' })
  completedAt: number;
}
