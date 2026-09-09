import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ResourceAgentService } from '../../services/resource-agent.service';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { EventsService } from '../events/events.service';
import { VideoAgentService } from '../../services/agents/video-agent.service';
import { GeneratedResourceService } from '../../services/generated-resource.service';
import {
  PlatformJobCancelledError,
  PlatformJobTrackerService,
} from './platform-job-tracker.service';
import { LlmService } from '../../services/llm.service';
import { UserLlmService } from '../user-llm/user-llm.service';
import { MultimodalService } from '../../services/multimodal.service';

/**
 * 资源生成任务处理器
 *
 * 支持的资源类型：
 *   - lecture：生成讲义（Markdown）
 *   - quiz：生成选择题
 *   - coding：生成编程题
 *   - reading：生成阅读材料（复用讲义）
 *   - path_resources：批量为学习路径生成所有资源
 *
 * §23 每步通过 SSE 推送进度 + 资源就绪事件给前端（智能体办公室）
 */
@Processor('resource-tasks', { prefix: 'zhipath' })
export class ResourceProcessor extends WorkerHost {
  constructor(
    private resourceAgent: ResourceAgentService,
    private knowledgeBase: KnowledgeBaseService,
    private events: EventsService,
    private videoAgent: VideoAgentService,
    private generatedResources: GeneratedResourceService,
    private platformJobs: PlatformJobTrackerService,
    private llmContext: LlmService,
    private userLlm: UserLlmService,
    private multimodal: MultimodalService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { userId, platformJobId } = job.data;
    const [config, attribution] = await Promise.all([
    this.userLlm.getForCall(Number(userId), Number(job.data?.tenantId || 1)).catch(() => undefined),
      this.platformJobs.getAttribution(platformJobId),
    ]);
    return this.llmContext.withUser(
      config,
      () => this.processWithContext(job),
      attribution,
    );
  }

  private async processWithContext(job: Job): Promise<any> {
    const { userId, resourceType, params, platformJobId, tenantId = 1 } = job.data;
    const jobId = String(job.id);

    if (!(await this.platformJobs.start(platformJobId))) {
      return { cancelled: true };
    }

    console.log(`[ResourceProcessor] Processing ${resourceType} for user ${userId}, job ${job.id}`);
    this.events.emitAgentStatus(userId, 'ResourceAgent', 'working', `生成 ${params.skillName || '学习路径'} 资源中`, tenantId);

    await this.saveQueueResource(
      userId,
      jobId,
      resourceType,
      params || {},
      null,
      resourceType === 'video' ? 'VideoAgent' : 'ResourceAgent',
      'running',
      tenantId,
    );

    try {
      let result: any;
      await this.platformJobs.assertActive(platformJobId);

      switch (resourceType) {
        case 'lecture':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」讲义`, tenantId);
          result = await this.resourceAgent.generateLecture(
            params.skillName,
            params.difficulty || 'beginner',
            { tenantId },
          );
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」讲义已生成`, tenantId);
          this.events.emitResourceReady(userId, params.skillName, 'lecture', tenantId);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'lecture', params, result, 'ResourceAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'lecture', skill: params.skillName, generated: !!result, result });

        case 'quiz':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」练习题`, tenantId);
          result = await this.resourceAgent.generateQuiz(
            params.skillName,
            params.count || 5,
            params.difficulty || 'beginner',
            { tenantId },
          );
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」练习题已生成`, tenantId);
          this.events.emitResourceReady(userId, params.skillName, 'quiz', tenantId);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'quiz', params, result, 'ResourceAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'quiz', skill: params.skillName, count: result?.length || 0, generated: !!result, result });

        case 'coding':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」编程题`, tenantId);
          result = await this.resourceAgent.generateCodingProblems(
            params.skillName,
            params.count || 2,
            params.difficulty || 'beginner',
            { tenantId },
          );
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」编程题已生成`, tenantId);
          this.events.emitResourceReady(userId, params.skillName, 'coding', tenantId);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'coding', params, result, 'ResourceAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'coding', skill: params.skillName, count: result?.length || 0, generated: !!result, result });

        case 'reading':
          // 阅读材料复用讲义生成
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」阅读材料`, tenantId);
          result = await this.resourceAgent.generateLecture(
            params.skillName,
            params.difficulty || 'beginner',
            { tenantId },
          );
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitResourceReady(userId, params.skillName, 'reading', tenantId);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'reading', params, result, 'ResourceAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'reading', skill: params.skillName, generated: !!result, result });

        case 'video': {
          await job.updateProgress(5);
          this.events.emitAgentProgress(userId, 'VideoAgent', jobId, 5, `正在生成「${params.skillName}」教学视频`, tenantId);
          result = await this.videoAgent.generate(
            {
              task_id: jobId,
              skill_name: params.skillName,
              knowledge_content: params.knowledgeContent || '',
              difficulty: params.difficulty || 'beginner',
              target_duration_sec: params.targetDurationSec,
            },
            (stage, progress, message) => {
              const adjustedProgress = Math.round(5 + progress * 0.9);
              this.events.emitAgentProgress(userId, 'VideoAgent', jobId, adjustedProgress, message, tenantId);
              void this.platformJobs.progress(platformJobId, adjustedProgress);
            },
          );
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'VideoAgent', jobId, 100, `「${params.skillName}」视频已生成`, tenantId);
          this.events.emitResourceReady(userId, params.skillName, 'video', tenantId);
          this.events.emitAgentStatus(userId, 'VideoAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'video', params, result, 'VideoAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'video', skill: params.skillName, generated: result.status === 'completed', result });
        }

        case 'animation':
        case 'diagram':
        case 'avatar': {
          await job.updateProgress(10);
          const label = resourceType === 'animation' ? '动画' : resourceType === 'diagram' ? '图表' : '数字人讲解';
          this.events.emitAgentProgress(userId, 'MultimodalAgent', jobId, 10, `正在生成「${params.skillName}」${label}`, tenantId);
          if (resourceType === 'animation') {
            result = await this.multimodal.generateAnimation(params.skillName, params.difficulty || 'beginner', tenantId);
          } else if (resourceType === 'diagram') {
            result = await this.multimodal.generateDiagram(params.skillName, params.diagramType || 'flowchart', tenantId);
          } else {
            result = await this.multimodal.generateAvatar(params.skillName, tenantId);
          }
          await this.platformJobs.assertActive(platformJobId);
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'MultimodalAgent', jobId, 100, `「${params.skillName}」${label}已生成`, tenantId);
          this.events.emitResourceReady(userId, params.skillName, resourceType, tenantId);
          this.events.emitAgentStatus(userId, 'MultimodalAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, resourceType, params, result, 'MultimodalAgent', 'success', tenantId);
          // MultimodalService already returns the stable { type, data } envelope;
          // keep it intact so synchronous and asynchronous callers share DTO shape.
          return this.completePlatformJob(platformJobId, result);
        }

        case 'path_resources': {
          // 批量为学习路径中所有技能生成资源 — 逐技能推送进度
          await job.updateProgress(5);
          const skills = this.extractSkills(params.pathData);
          const resourceContext = { ...this.resourceAgent.contextFromPathData(params.pathData || {}), tenantId };
          const total = skills.length || 1;
          let done = 0;
          let generated = 0;
          let skipped = 0;
          let failed = 0;

          for (const skill of skills) {
            await this.platformJobs.assertActive(platformJobId);
            try {
              const lecture = await this.resourceAgent.generateLecture(skill.name, skill.difficulty, resourceContext);
              await this.resourceAgent.generateQuiz(skill.name, 5, skill.difficulty, resourceContext);
              if (lecture) generated++; else skipped++;
              this.events.emitResourceReady(userId, skill.name, 'lecture', tenantId);
            } catch (e: any) {
              failed++;
              console.warn(`[ResourceProcessor] path skill "${skill.name}" failed:`, e.message);
            }
            done++;
            await this.platformJobs.assertActive(platformJobId);
            const progress = Math.round(5 + (done / total) * 95);
            await job.updateProgress(progress);
            this.events.emitAgentProgress(
              userId, 'ResourceAgent', jobId, progress,
              `学习资源生成中 ${done}/${total}：${skill.name}`, tenantId,
            );
          }

          await job.updateProgress(100);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
          await this.saveQueueResource(userId, jobId, 'path_resources', params, { generated, skipped, failed, total }, 'ResourceAgent', 'success', tenantId);
          return this.completePlatformJob(platformJobId, { type: 'path_resources', generated, skipped, failed, total });
        }

        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (e: any) {
      if (e instanceof PlatformJobCancelledError) {
        this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, -1, `${resourceType} 任务已取消`, tenantId);
        this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle', undefined, tenantId);
        return { cancelled: true };
      }
      const willRetry = job.attemptsMade + 1 < Number(job.opts.attempts || 1);
      await this.platformJobs.fail(platformJobId, e, willRetry);
      console.error(`[ResourceProcessor] Failed ${resourceType} for user ${userId}:`, e.message);
      this.events.emitAgentStatus(userId, 'ResourceAgent', 'error', e.message, tenantId);
      await this.generatedResources.upsert({
        userId,
        resourceType: resourceType || 'error',
        title: params?.skillName ? `${params.skillName} ${resourceType}` : `${resourceType} resource`,
        status: 'failed',
        source: 'queue',
        externalId: this.queueExternalId(String(job.id), resourceType),
        chatSessionId: params?._chatSessionId || params?.chatSessionId || params?.sessionId || null,
        skillName: params?.skillName || null,
        agentType: resourceType === 'video' ? 'VideoAgent' : 'ResourceAgent',
        payload: { message: e.message },
        previewMeta: { actionType: 'error' },
        rawRequest: params || null,
        errorMessage: e.message,
        tenantId,
      }).catch((err) => console.warn('[ResourceProcessor] generated resource failure upsert failed:', err.message));
      throw e;
    }
  }

  private async completePlatformJob(platformJobId: string | undefined, result: any) {
    return (await this.platformJobs.complete(platformJobId, result))
      ? result
      : { cancelled: true };
  }

  /** 从 pathData 抽取去重技能列表（含难度） */
  private async saveQueueResource(
    userId: number,
    jobId: string,
    resourceType: string,
    params: Record<string, any>,
    payload: any,
    agentType: string,
    status: 'running' | 'success' = 'success',
    tenantId = 1,
  ): Promise<void> {
    await this.generatedResources.upsert({
      userId,
      tenantId,
      resourceType,
      title: params?.skillName ? `${params.skillName} ${resourceType}` : `${resourceType} resource`,
      status,
      source: 'queue',
      externalId: this.queueExternalId(jobId, resourceType),
      chatSessionId: params?._chatSessionId || params?.chatSessionId || params?.sessionId || null,
      skillName: params?.skillName || null,
      agentType,
      payload,
      previewMeta: {
        actionType: this.actionTypeForQueueResource(resourceType),
      },
      rawRequest: params || null,
      rawResponse: payload && typeof payload === 'object' ? payload : null,
    }).catch((e) => console.warn('[ResourceProcessor] generated resource upsert failed:', e.message));
  }

  private queueExternalId(jobId: string, resourceType: string): string {
    return `resource-job:${jobId}:${resourceType}`;
  }

  private actionTypeForQueueResource(resourceType: string): string {
    if (resourceType === 'quiz' || resourceType === 'coding') return 'exam';
    if (resourceType === 'path_resources' || resourceType === 'lecture' || resourceType === 'reading') return 'resources';
    return resourceType;
  }

  private extractSkills(pathData: Record<string, any>): Array<{ name: string; difficulty: string }> {
    const seen = new Set<string>();
    const out: Array<{ name: string; difficulty: string }> = [];
    const phases = pathData?.phases || [];
    for (let i = 0; i < phases.length; i++) {
      const difficulty = i === 0 ? 'beginner' : i === 1 ? 'intermediate' : 'advanced';
      for (const sk of phases[i].skills || []) {
        const name = typeof sk === 'string' ? sk : sk.name;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          out.push({ name, difficulty });
        }
      }
    }
    return out;
  }
}
