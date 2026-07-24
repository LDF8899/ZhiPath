import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AgentTask } from '../entities/agent-task.entity';
import {
  GeneratedResource,
  GeneratedResourceSource,
  GeneratedResourceStatus,
} from '../entities/generated-resource.entity';

interface ResourceUpsertInput {
  userId: number;
  resourceType: string;
  title: string;
  status: GeneratedResourceStatus;
  source?: GeneratedResourceSource;
  sourceTaskId?: number | null;
  externalId?: string | null;
  chatSessionId?: string | null;
  chatMessageId?: string | null;
  agentType?: string | null;
  skillName?: string | null;
  payload?: Record<string, any> | any[] | null;
  previewMeta?: Record<string, any> | null;
  provider?: string | null;
  rawRequest?: Record<string, any> | null;
  rawResponse?: Record<string, any> | null;
  errorMessage?: string | null;
}

const ACTION_TO_RESOURCE: Record<string, string> = {
  jobs: 'jobs',
  target_set: 'target',
  path_generating: 'path',
  path_generated: 'path',
  resources: 'resources',
  exam: 'quiz',
  progress: 'progress',
  today_tasks: 'today_tasks',
  animation: 'animation',
  diagram: 'diagram',
  video: 'video',
  video_pending: 'video',
  avatar: 'avatar',
  skill_gap: 'skill_gap',
  error: 'error',
};

const ACTION_REQUEST_TO_ACTION: Record<string, string> = {
  recommend_jobs: 'jobs',
  match_analysis: 'skill_gap',
  set_target_job: 'target_set',
  generate_path: 'path_generated',
  recommend_resources: 'resources',
  generate_exam: 'exam',
  show_progress: 'progress',
  show_today_tasks: 'today_tasks',
  generate_animation: 'animation',
  generate_diagram: 'diagram',
  generate_video: 'video_pending',
  generate_avatar: 'avatar',
};

const AGENT_TO_RESOURCE: Record<string, string> = {
  lecture: 'lecture',
  reading: 'reading',
  code: 'coding',
  path: 'path',
  assess: 'progress',
  exam: 'quiz',
  skillgap: 'skill_gap',
  resume: 'resume',
  profile: 'profile',
  news: 'news',
};

@Injectable()
export class GeneratedResourceService {
  constructor(
    @InjectRepository(GeneratedResource)
    private readonly resourceRepo: Repository<GeneratedResource>,
  ) {}

  async listForUser(
    userId: number,
    filters: {
      chatSessionId?: string;
      source?: GeneratedResourceSource;
      resourceType?: string;
      status?: GeneratedResourceStatus;
      limit?: number;
    } = {},
  ): Promise<GeneratedResource[]> {
    const where: FindOptionsWhere<GeneratedResource> = { userId, status: 1 };
    if (filters.chatSessionId) where.chatSessionId = filters.chatSessionId;
    if (filters.source) where.source = filters.source;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.status) where.resourceStatus = filters.status;

    return this.resourceRepo.find({
      where,
      order: { updateTime: 'DESC', createTime: 'DESC' },
      take: Math.min(Math.max(filters.limit || 100, 1), 200),
    });
  }

  async getById(userId: number, id: number): Promise<GeneratedResource | null> {
    return this.resourceRepo.findOne({ where: { id, userId, status: 1 } });
  }

  async setFeedback(userId: number, id: number, useful: boolean): Promise<GeneratedResource | null> {
    const resource = await this.getById(userId, id);
    if (!resource) return null;
    const previewMeta = {
      ...(resource.previewMeta || {}),
      feedbackUseful: useful,
      feedbackAt: Date.now(),
    };
    await this.resourceRepo.update(resource.id, {
      previewMeta: previewMeta as GeneratedResource['previewMeta'],
      updateTime: Date.now(),
    });
    return this.getById(userId, id);
  }

  async upsertFromTask(userId: number, task: AgentTask, result?: any): Promise<GeneratedResource> {
    const normalized = this.normalizeTask(userId, task, result ?? task.result);
    return this.upsert(normalized);
  }

  async failFromTask(userId: number, task: AgentTask, errorMessage: string): Promise<GeneratedResource> {
    const normalized = this.normalizeTask(userId, task, task.result);
    return this.upsert({
      ...normalized,
      status: 'failed',
      resourceType: normalized.resourceType === 'unknown' ? 'error' : normalized.resourceType,
      errorMessage,
      payload: normalized.payload || { message: errorMessage },
      previewMeta: {
        ...(normalized.previewMeta || {}),
        actionType: 'error',
      },
    });
  }

  async upsert(input: ResourceUpsertInput): Promise<GeneratedResource> {
    const now = Date.now();
    const externalId = input.externalId || this.createStableExternalId(input);
    let existing = await this.resourceRepo.findOne({ where: { externalId, status: 1 } });
    if (!existing && input.sourceTaskId) {
      existing = await this.resourceRepo.findOne({
        where: { sourceTaskId: input.sourceTaskId, userId: input.userId, status: 1 },
      });
    }

    const patch: Partial<GeneratedResource> = {
      userId: input.userId,
      resourceType: input.resourceType || 'unknown',
      title: input.title || this.titleFor(input.resourceType, input.skillName),
      skillName: input.skillName || null,
      source: input.source || 'manual',
      sourceTaskId: input.sourceTaskId || null,
      externalId,
      chatSessionId: input.chatSessionId || null,
      chatMessageId: input.chatMessageId || null,
      agentType: input.agentType || null,
      resourceStatus: input.status,
      payload: input.payload ?? null,
      previewMeta: input.previewMeta || null,
      provider: input.provider || null,
      rawRequest: input.rawRequest || null,
      rawResponse: input.rawResponse || null,
      errorMessage: input.errorMessage || null,
      updateTime: now,
      status: 1,
    };

    if (existing) {
      await this.resourceRepo.update(existing.id, patch);
      return this.resourceRepo.findOne({ where: { id: existing.id } }) as Promise<GeneratedResource>;
    }

    return this.resourceRepo.save({
      ...patch,
      createTime: now,
      costTokens: 0,
      costCredits: 0,
      durationMs: null,
    });
  }

  private normalizeTask(userId: number, task: AgentTask, result: any): ResourceUpsertInput {
    const params = task.params || {};
    const taskStatus = this.statusFromTask(task.taskStatus);
    const actionType = this.actionTypeFromResult(result) || this.actionTypeFromParams(params, taskStatus);
    const resourceType = actionType
      ? ACTION_TO_RESOURCE[actionType] || actionType
      : AGENT_TO_RESOURCE[task.agentType] || 'unknown';
    const payload = this.payloadFromResult(result);
    const skillName = this.skillOf(payload) || this.skillOf(result) || this.skillOf(params);
    const source = params._source === 'chat' || params.source === 'chat' ? 'chat' : 'agent_office';
    const chatSessionId = params._chatSessionId || params.chatSessionId || params.sessionId || null;

    return {
      userId,
      resourceType,
      title: this.titleFor(resourceType, skillName, task.title),
      status: taskStatus,
      source,
      sourceTaskId: task.id,
      externalId: task.externalId || `agent-task:${task.id}`,
      chatSessionId,
      agentType: task.agentType,
      skillName,
      payload,
      previewMeta: {
        actionType: actionType || this.actionTypeFromResource(resourceType, taskStatus),
        actionKey: task.externalId ? `task:${task.externalId}` : `task:${task.id}`,
        progress: task.progress,
      },
      provider: this.providerOf(payload),
      rawRequest: params,
      rawResponse: result && typeof result === 'object' ? result : null,
      errorMessage: task.errorMessage || null,
    };
  }

  private statusFromTask(status: AgentTask['taskStatus']): GeneratedResourceStatus {
    if (status === 'success') return 'success';
    if (status === 'failed' || status === 'cancelled') return 'failed';
    if (status === 'running') return 'running';
    return 'pending';
  }

  private actionTypeFromResult(result: any): string | null {
    if (!result || typeof result !== 'object') return null;
    const action = this.actionResultFrom(result);
    if (action?.type) return action.type;
    if (result.video_file_path || result.videoFilePath || result.video_file || result.videoFile || result.url) return 'video';
    const actionData = action?.data;
    if (actionData?.video_file_path || actionData?.videoFilePath || actionData?.video_file || actionData?.videoFile || actionData?.url) return 'video';
    return null;
  }

  private actionTypeFromParams(params: Record<string, any>, status: GeneratedResourceStatus): string | null {
    const requestType = typeof params?.type === 'string' ? params.type : '';
    const actionType = ACTION_REQUEST_TO_ACTION[requestType] || null;
    if (actionType === 'video_pending' && status === 'success') return 'video';
    return actionType;
  }

  private payloadFromResult(result: any): any {
    if (!result || typeof result !== 'object') return null;
    const action = this.actionResultFrom(result);
    if (action) {
      if (action.data !== undefined) return action.data;
      return { message: action.message || action.error || '' };
    }
    return result;
  }

  private actionResultFrom(result: any): any | null {
    if (!result || typeof result !== 'object') return null;
    if (typeof result.type === 'string') return result;
    if (Array.isArray(result.actions)) {
      return result.actions.find((action: any) => action && typeof action.type === 'string') || null;
    }
    return null;
  }

  private actionTypeFromResource(resourceType: string, status: GeneratedResourceStatus): string {
    if (status === 'failed') return 'error';
    const map: Record<string, string> = {
      quiz: 'exam',
      coding: 'exam',
      path: 'path_generated',
      resources: 'resources',
      lecture: 'resources',
      reading: 'resources',
      animation: 'animation',
      diagram: 'diagram',
      video: status === 'success' ? 'video' : 'video_pending',
      path_resources: 'resources',
      avatar: 'avatar',
      skill_gap: 'skill_gap',
      progress: 'progress',
      today_tasks: 'today_tasks',
      jobs: 'jobs',
    };
    return map[resourceType] || resourceType;
  }

  private skillOf(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    return data.skillName || data.skill_name || data.skill || data.title || null;
  }

  private providerOf(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    return data.provider || null;
  }

  private titleFor(resourceType: string, skillName?: string | null, fallback?: string): string {
    if (fallback) return fallback;
    const subject = skillName || 'generated';
    return `${subject} ${resourceType || 'resource'}`;
  }

  private createStableExternalId(input: ResourceUpsertInput): string {
    if (input.sourceTaskId) return `agent-task:${input.sourceTaskId}`;
    const scope = input.chatSessionId || input.source || 'manual';
    return `${input.userId}:${scope}:${input.resourceType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }
}
