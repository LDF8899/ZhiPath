import { Injectable } from '@nestjs/common';
import { AgentTask } from '../entities/agent-task.entity';
import { AgentTaskService } from './agent-task.service';
import { AgentProfileService } from './agent-profile.service';
import { EventsService } from '../modules/events/events.service';
import { GeneratedResourceService } from './generated-resource.service';

type OfficeAgentType = AgentTask['agentType'];

interface OfficeActionMeta {
  agentType: OfficeAgentType;
  title: string;
  description: string;
}

const ACTION_AGENT_MAP: Record<string, OfficeAgentType> = {
  generate_path: 'path',
  recommend_jobs: 'skillgap',
  match_analysis: 'skillgap',
  set_target_job: 'profile',
  generate_exam: 'exam',
  show_progress: 'assess',
  show_today_tasks: 'path',
  recommend_resources: 'reading',
  query_knowledge: 'knowledge',
  knowledge_ingest: 'knowledge',
  knowledge_news_refresh: 'knowledge',
  generate_animation: 'code',
  generate_diagram: 'code',
  generate_video: 'code',
  generate_avatar: 'profile',
};

const ACTION_LABELS: Record<string, string> = {
  generate_path: '规划学习路径',
  recommend_jobs: '推荐匹配岗位',
  match_analysis: '分析技能差距',
  set_target_job: '设置目标岗位',
  generate_exam: '生成练习题',
  show_progress: '查询学习进度',
  show_today_tasks: '整理今日任务',
  recommend_resources: '推荐学习资源',
  query_knowledge: '检索知识库',
  knowledge_ingest: '清洗知识库资料',
  knowledge_news_refresh: '抓取资讯入库',
  generate_animation: '生成动画演示',
  generate_diagram: '生成图解',
  generate_video: '生成教学视频',
  generate_avatar: '生成数字人讲解',
};

@Injectable()
export class AgentOfficeBridgeService {
  constructor(
    private readonly taskService: AgentTaskService,
    private readonly profileService: AgentProfileService,
    private readonly eventsService: EventsService,
    private readonly generatedResources: GeneratedResourceService,
  ) {}

  getAgentForAction(actionType: string): OfficeAgentType | null {
    return ACTION_AGENT_MAP[actionType] || null;
  }

  getMeta(action: any): OfficeActionMeta | null {
    const type = action?.type;
    const agentType = this.getAgentForAction(type);
    if (!agentType) return null;

    const skillName = action.skillName || action.skill_name || action.skill || '';
    const label = ACTION_LABELS[type] || type;
    return {
      agentType,
      title: skillName ? `${label}: ${skillName}` : label,
      description: `来自对话触发的 ${label}`,
    };
  }

  async runTrackedAction<T>(
    userId: number,
    action: any,
    execute: () => Promise<T>,
  ): Promise<T> {
    const task = await this.startActionTask(userId, action);
    if (!task) return execute();

    try {
      await this.reportProgress(userId, task.id, task.agentType, 30, 'Agent 正在处理...');
      const result = await execute();

      const errorMessage = this.getResultErrorMessage(result);
      if (errorMessage) {
        await this.failTask(userId, task.id, task.agentType, errorMessage);
      } else {
        await this.reportProgress(userId, task.id, task.agentType, 90, '正在整理结果...');
        await this.completeTask(userId, task.id, task.agentType, result as Record<string, any>);
      }
      return result;
    } catch (e: any) {
      await this.failTask(userId, task.id, task.agentType, e.message || '任务执行失败');
      throw e;
    }
  }

  async startActionTask(
    userId: number,
    action: any,
    options?: { externalId?: string; title?: string; description?: string },
  ): Promise<AgentTask | null> {
    const meta = this.getMeta(action);
    if (!meta) return null;

    await this.profileService.ensureAgent(userId, meta.agentType).catch(() => null);

    const externalId = options?.externalId || this.createExternalId(userId, action.type);
    const task = await this.taskService.upsertTaskStatus(
      userId,
      meta.agentType,
      options?.title || meta.title,
      externalId,
      {
        taskStatus: 'running',
        progress: 10,
        params: action,
        description: options?.description || meta.description,
      },
    );
    const runningTask = (await this.taskService.updateStatus(task.id, 'running')) || task;
    await this.taskService.updateProgress(task.id, 10);
    await this.generatedResources.upsertFromTask(userId, runningTask).catch((e) =>
      console.warn('[AgentOfficeBridge] generated resource running upsert failed:', e.message),
    );

    await this.profileService.updateStatus(userId, meta.agentType, 'busy').catch(() => {});
    this.eventsService.emitAgentStatus(userId, meta.agentType, 'working', runningTask.title);
    this.eventsService.emitAgentProgress(userId, meta.agentType, String(runningTask.id), 10, '任务已进入办公室');

    return runningTask;
  }

  async reportProgress(
    userId: number,
    taskId: number,
    agentType: OfficeAgentType,
    progress: number,
    message?: string,
  ): Promise<void> {
    await this.taskService.updateProgress(taskId, progress);
    const task = await this.taskService.getTask(taskId, userId).catch(() => null);
    if (task) {
      await this.generatedResources.upsertFromTask(userId, task).catch((e) =>
        console.warn('[AgentOfficeBridge] generated resource progress upsert failed:', e.message),
      );
    }
    this.eventsService.emitAgentProgress(userId, agentType, String(taskId), progress, message);
  }

  async completeTask(
    userId: number,
    taskId: number,
    agentType: OfficeAgentType,
    result?: Record<string, any>,
  ): Promise<void> {
    const task = await this.taskService.updateStatus(taskId, 'success', result);
    if (task) {
      const resource = await this.generatedResources.upsertFromTask(userId, task, result).catch((e) => {
        console.warn('[AgentOfficeBridge] generated resource upsert failed:', e.message);
        return null;
      });
      if (resource) {
        this.eventsService.emitResourceReady(userId, resource.skillName || task.title, resource.resourceType);
      }
    }
    await this.releaseAgentIfNoRunningTasks(userId, agentType, taskId);
    this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 100, '完成');
    this.eventsService.emitAgentStatus(userId, agentType, 'idle');
  }

  async failTask(
    userId: number,
    taskId: number,
    agentType: OfficeAgentType,
    errorMessage: string,
  ): Promise<void> {
    const task = await this.taskService.updateStatus(taskId, 'failed', undefined, errorMessage);
    if (task) {
      const resource = await this.generatedResources.failFromTask(userId, task, errorMessage).catch((e) => {
        console.warn('[AgentOfficeBridge] generated resource failure upsert failed:', e.message);
        return null;
      });
      if (resource) {
        this.eventsService.emitResourceReady(userId, resource.skillName || task.title, resource.resourceType);
      }
    }
    await this.releaseAgentIfNoRunningTasks(userId, agentType, taskId);
    this.eventsService.emitAgentProgress(userId, agentType, String(taskId), -1, `失败: ${errorMessage}`);
    this.eventsService.emitAgentStatus(userId, agentType, 'error', errorMessage);
  }

  private async releaseAgentIfNoRunningTasks(
    userId: number,
    agentType: OfficeAgentType,
    finishedTaskId: number,
  ): Promise<void> {
    const stillRunning = await this.taskService
      .hasRunningTask(userId, agentType, finishedTaskId)
      .catch(() => false);

    if (stillRunning) return;

    await this.profileService
      .updateStatus(userId, agentType, 'idle', { releaseStation: true })
      .catch(() => {});
  }

  private createExternalId(userId: number, actionType: string): string {
    return `chat:${userId}:${actionType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private getResultErrorMessage(result: any): string | null {
    if (!result || typeof result !== 'object') return null;
    if (result.type === 'error') {
      return result.message || result.data?.message || '任务执行失败';
    }
    return null;
  }
}
