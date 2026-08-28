import type { ChatAction, GeneratedResource, ResourceItem } from '../types';
import { getAgentOfficeHistory, getAgentOfficeTasks, getChatSession, getGeneratedResources, getKnowledge } from '../api/user';
import { useChatStore } from '../stores/chat';

const RESOURCE_KEY = 'zhpath_resources';

type AgentTaskLike = {
  id: number;
  agentType: string;
  title?: string;
  description?: string;
  params?: Record<string, any> | null;
  taskStatus: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress?: number;
  result?: Record<string, any> | null;
  errorMessage?: string;
  createTime?: number;
  externalId?: string | null;
};

export function saveResource(item: Omit<ResourceItem, 'id' | 'savedAt' | 'source'>) {
  try {
    const existing: ResourceItem[] = JSON.parse(localStorage.getItem(RESOURCE_KEY) || '[]');
    const dup = existing.find((r) => r.skill === item.skill && r.type === item.type);
    if (dup) {
      dup.data = item.data;
      dup.savedAt = Date.now();
    } else {
      existing.unshift({ ...item, id: `res_${Date.now()}`, savedAt: Date.now(), source: 'chat' });
    }
    localStorage.setItem(RESOURCE_KEY, JSON.stringify(existing.slice(0, 100)));
  } catch {
    // localStorage may be unavailable or full.
  }
}

function skillOf(data: any): string {
  return data?.skillName || data?.skill_name || data?.skill || data?.title || '';
}

export function getChatActionKey(action: ChatAction): string {
  if (action.key) return action.key;
  const data = action.data || {};
  if (data.taskId) return `task:${data.taskId}`;
  const skill = skillOf(data);
  if (action.type === 'video' || action.type === 'video_pending') {
    return `video:${skill || data.video_file_path || data.videoFilePath || data.video_file || data.videoFile || data.url || 'unknown'}`;
  }
  if (action.type === 'exam') return `exam:${skill || 'unknown'}`;
  if (action.type === 'animation') return `animation:${skill || 'unknown'}`;
  if (action.type === 'diagram') return `diagram:${skill || 'unknown'}`;
  if (action.type === 'resources') return `resources:${skill || JSON.stringify(data).slice(0, 120)}`;
  if (action.type === 'error') return `error:${data.taskId || data.message || 'unknown'}`;
  return `${action.type}:${skill || JSON.stringify(data).slice(0, 120)}`;
}

export function saveResourcesFromActions(actions: ChatAction[]) {
  for (const action of actions) {
    const data = action.data || {};
    const skill = skillOf(data);
    if (action.type === 'exam' && data.questions && skill) {
      saveResource({ skill, type: 'quiz', title: `${skill} quiz`, data });
    } else if (action.type === 'animation' && data.html && skill) {
      saveResource({ skill, type: 'animation', title: `${skill} animation`, data });
    } else if (action.type === 'diagram' && data.mermaid && skill) {
      saveResource({ skill, type: 'diagram', title: `${skill} diagram`, data });
    } else if ((action.type === 'video' || action.type === 'video_pending') && skill) {
      saveResource({ skill, type: 'video', title: `${skill} video`, data });
    }
  }
}

export async function actionsFromResourceReadyEvent(data: any): Promise<ChatAction[]> {
  const skillName = data?.skill_name || data?.skillName;
  const contentType = data?.content_type || data?.contentType;
  if (!skillName || !contentType) return [];

  const res = await getKnowledge(encodeURIComponent(skillName));
  if (res.code !== 200 || !res.data) return [];

  const kb = res.data;
  const actions: ChatAction[] = [];
  if ((contentType === 'lecture' || contentType === 'reading') && kb.lecture) {
    actions.push({
      type: 'resources',
      data: [{
        title: `${skillName} lecture`,
        type: contentType === 'lecture' ? '文档' : '教程',
        url: `/user/knowledge/${encodeURIComponent(skillName)}`,
      }],
    });
    saveResource({ skill: skillName, type: 'lecture', title: `${skillName} lecture`, data: kb.lecture });
  } else if (contentType === 'quiz' || contentType === 'coding') {
    const quizData = contentType === 'quiz' ? kb.quiz : kb.coding;
    if (quizData) {
      const payload = {
        skill: skillName,
        questions: Array.isArray(quizData) ? quizData : quizData.questions || [],
      };
      actions.push({ type: 'exam', data: payload });
      saveResource({
        skill: skillName,
        type: contentType as 'quiz' | 'coding',
        title: `${skillName} ${contentType}`,
        data: payload,
      });
    }
  } else if (contentType === 'animation' && kb.animation) {
    const payload = { skill: skillName, skillName, title: `${skillName} animation`, html: kb.animation };
    actions.push({ type: 'animation', data: payload });
    saveResource({ skill: skillName, type: 'animation', title: `${skillName} animation`, data: payload });
  } else if (contentType === 'diagram' && kb.diagram) {
    const payload = { skill: skillName, skillName, title: `${skillName} diagram`, mermaid: kb.diagram };
    actions.push({ type: 'diagram', data: payload });
    saveResource({ skill: skillName, type: 'diagram', title: `${skillName} diagram`, data: payload });
  }

  return actions.map((a) => ({ ...a, key: getChatActionKey(a) }));
}

function chatSessionIdFromTask(task: AgentTaskLike): string {
  const params = task.params || {};
  return params._chatSessionId || params.chatSessionId || params.sessionId || '';
}

function normalizeActionResult(result: any, task: AgentTaskLike): ChatAction | null {
  if (!result || typeof result !== 'object') return null;
  if (typeof result.type === 'string' && result.data !== undefined) {
    return result as ChatAction;
  }

  const params = task.params || {};
  const skill = result.skill_name || result.skillName || params.skillName || params.skill_name || params.skill || '';
  const taskId = task.externalId || params.taskId || String(task.id);

  if (result.video_file_path || result.videoFilePath || result.video_file || result.videoFile || result.url) {
    return {
      type: 'video',
      data: {
        ...result,
        skill,
        skillName: skill,
        taskId,
        status: 'completed',
      },
    };
  }

  return null;
}

function pendingActionFromTask(task: AgentTaskLike): ChatAction | null {
  const params = task.params || {};
  if (params.type !== 'generate_video') return null;
  const skillName = params.skillName || params.skill_name || params.skill || '';
  const taskId = task.externalId || params.taskId || String(task.id);
  return {
    type: 'video_pending',
    data: {
      taskId,
      skillName,
      difficulty: params.difficulty || 'beginner',
      progress: task.progress || 0,
      status: 'pending',
      message: task.title || 'Video generation is running',
    },
  };
}

function actionFromTask(task: AgentTaskLike): ChatAction | null {
  if (task.taskStatus === 'pending' || task.taskStatus === 'running') {
    return pendingActionFromTask(task);
  }
  if (task.taskStatus === 'success') {
    return normalizeActionResult(task.result, task);
  }
  if (task.taskStatus === 'failed') {
    return {
      type: 'error',
      data: {
        taskId: task.externalId || String(task.id),
        message: task.errorMessage || 'Agent task failed',
      },
    };
  }
  return null;
}

function actionFromGeneratedResource(resource: GeneratedResource): ChatAction | null {
  const payload = resource.payload || {};
  const meta = resource.previewMeta || {};
  const actionType = meta.actionType || actionTypeFromResource(resource);

  if (resource.resourceStatus === 'failed') {
    return {
      type: 'error',
      data: {
        taskId: resource.externalId || resource.sourceTaskId || resource.id,
        message: resource.errorMessage || payload.message || 'Agent task failed',
      },
    };
  }

  if ((resource.resourceStatus === 'pending' || resource.resourceStatus === 'running') && resource.resourceType === 'video') {
    return {
      type: 'video_pending',
      data: {
        ...payload,
        taskId: resource.externalId || resource.sourceTaskId || resource.id,
        skillName: resource.skillName || payload.skillName || payload.skill_name || payload.skill || '',
        progress: meta.progress || 0,
        status: resource.resourceStatus,
        message: resource.title || 'Video generation is running',
      },
    };
  }
  if (resource.resourceStatus === 'pending' || resource.resourceStatus === 'running') {
    return null;
  }

  if (!actionType || actionType === 'unknown') return null;
  return {
    type: actionType as ChatAction['type'],
    data: normalizeGeneratedPayload(resource, actionType, payload),
  };
}

function actionTypeFromResource(resource: GeneratedResource): string {
  const map: Record<string, ChatAction['type']> = {
    jobs: 'jobs',
    target: 'target_set',
    path: 'path_generated',
    resources: 'resources',
    lecture: 'resources',
    reading: 'resources',
    quiz: 'exam',
    coding: 'exam',
    progress: 'progress',
    today_tasks: 'today_tasks',
    animation: 'animation',
    diagram: 'diagram',
    video: resource.resourceStatus === 'success' ? 'video' : 'video_pending',
    path_resources: 'resources',
    avatar: 'avatar',
    skill_gap: 'skill_gap',
    error: 'error',
  };
  return map[resource.resourceType] || 'unknown';
}

function normalizeGeneratedPayload(resource: GeneratedResource, actionType: string, payload: any): any {
  const skillName = resource.skillName || payload.skillName || payload.skill_name || payload.skill || '';
  if (actionType === 'resources' && !Array.isArray(payload)) {
    const url = (typeof payload === 'object' && payload?.url) || `/user/knowledge/${encodeURIComponent(skillName || resource.title)}`;
    return [{
      title: resource.title,
      url,
      type: resource.resourceType === 'lecture' ? '文档' : resource.resourceType === 'reading' ? '教程' : resource.resourceType,
      skillName,
      resourceId: resource.id,
    }];
  }
  if (actionType === 'exam' && Array.isArray(payload)) {
    return {
      skill: skillName,
      skillName,
      questions: payload,
      resourceId: resource.id,
    };
  }
  if (actionType === 'exam' && !payload.skill && !payload.skillName && skillName) {
    return {
      ...payload,
      skill: skillName,
      skillName,
      questions: payload.questions || [],
      resourceId: resource.id,
    };
  }
  const hasVideoUrl = payload?.video_file_path || payload?.videoFilePath || payload?.video_file || payload?.videoFile || payload?.url;
  if (actionType === 'video' && payload?.result && !hasVideoUrl) {
    return {
      ...payload.result,
      skill: payload.result.skill || skillName,
      skillName: payload.result.skillName || payload.result.skill_name || skillName,
      status: payload.status === 'completed' || resource.resourceStatus === 'success' ? 'completed' : payload.status,
      resourceId: resource.id,
    };
  }
  if (actionType === 'video' && hasVideoUrl) {
    return {
      ...payload,
      video_file_path: payload.video_file_path || payload.videoFilePath,
      video_file: payload.video_file || payload.videoFile,
      skill: payload.skill || skillName,
      skillName: payload.skillName || payload.skill_name || skillName,
      status: payload.status === 'completed' || resource.resourceStatus === 'success' ? 'completed' : payload.status,
      resourceId: resource.id,
    };
  }
  if (['animation', 'diagram', 'video', 'avatar'].includes(actionType) && skillName) {
    const isDone = payload.status === 'completed' || resource.resourceStatus === 'success';
    return {
      ...payload,
      skill: payload.skill || skillName,
      skillName: payload.skillName || skillName,
      status: isDone ? 'completed' : payload.status,
      render_status: payload.render_status,
      render_error: payload.render_error,
      resourceId: resource.id,
    };
  }
  return payload;
}

export async function reconcileGeneratedResources(chatSessionId?: string): Promise<number> {
  const res = await getGeneratedResources({ chatSessionId, limit: 100 }).catch(() => ({ data: [] }));
  const resources = (res.data || []) as GeneratedResource[];
  const seen = new Set<string>();
  let applied = 0;
  const store = useChatStore.getState();

  for (const resource of resources) {
    const sessionId = resource.chatSessionId || '';
    if (!sessionId) continue;
    if (!chatSessionId && !store.mainMessages[sessionId]) continue;
    const action = actionFromGeneratedResource(resource);
    if (!action) continue;

    const key = resource.previewMeta?.actionKey || resource.externalId || `resource:${resource.id}`;
    const dedupeKey = `${sessionId}:${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const normalized = { ...action, key };
    saveResourcesFromActions([normalized]);
    if (useChatStore.getState().upsertMainMessageAction(sessionId, normalized, key)) {
      applied++;
    }
  }

  return applied;
}

export async function reconcileChatSessionResources(sessionId: string): Promise<number> {
  if (!sessionId) return 0;
  const store = useChatStore.getState();
  if (!store.mainMessages[sessionId]) {
    const detail = await getChatSession(sessionId).catch(() => null);
    if (detail?.code === 200 && detail.data) {
      store.setMainMessages(sessionId, detail.data.messages || []);
    }
  }
  const fromResources = await reconcileGeneratedResources(sessionId);
  const fromTasks = await reconcileChatAgentTasks(sessionId);
  return fromResources + fromTasks;
}

export async function reconcileChatAgentTasks(chatSessionId?: string): Promise<number> {
  const [tasksRes, historyRes, resourcesRes] = await Promise.all([
    getAgentOfficeTasks().catch(() => ({ data: [] })),
    getAgentOfficeHistory(50).catch(() => ({ data: [] })),
    getGeneratedResources({ limit: 100 }).catch(() => ({ data: [] })),
  ]);
  const allTasks = [...((tasksRes.data || []) as AgentTaskLike[]), ...((historyRes.data || []) as AgentTaskLike[])];
  const coveredTasks = new Set<string>();
  for (const resource of (resourcesRes.data || []) as GeneratedResource[]) {
    if (!resource.chatSessionId) continue;
    if (resource.sourceTaskId) coveredTasks.add(`id:${resource.sourceTaskId}`);
    if (resource.externalId) coveredTasks.add(`external:${resource.externalId}`);
  }
  const seen = new Set<string>();
  let applied = 0;

  for (const task of allTasks) {
    const sessionId = chatSessionIdFromTask(task);
    if (!sessionId) continue;
    if (chatSessionId && sessionId !== chatSessionId) continue;
    if (!chatSessionId && !useChatStore.getState().mainMessages[sessionId]) continue;
    if (coveredTasks.has(`id:${task.id}`) || (task.externalId && coveredTasks.has(`external:${task.externalId}`))) {
      continue;
    }
    const action = actionFromTask(task);
    if (!action) continue;
    const key = action.data?.taskId ? `task:${action.data.taskId}` : getChatActionKey(action);
    const dedupeKey = `${sessionId}:${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const normalized = { ...action, key };
    saveResourcesFromActions([normalized]);
    if (useChatStore.getState().upsertMainMessageAction(sessionId, normalized, key)) {
      applied++;
    }
  }

  return applied;
}

export function upsertActionsIntoSession(sessionId: string, actions: ChatAction[]): number {
  let applied = 0;
  const store = useChatStore.getState();
  for (const action of actions) {
    const key = getChatActionKey(action);
    const normalized = { ...action, key };
    saveResourcesFromActions([normalized]);
    if (store.upsertMainMessageAction(sessionId, normalized, key)) {
      applied++;
    }
  }
  return applied;
}
