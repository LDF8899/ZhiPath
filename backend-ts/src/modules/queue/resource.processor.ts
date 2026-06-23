import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ResourceAgentService } from '../../services/resource-agent.service';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { EventsService } from '../events/events.service';
import { VideoAgentService } from '../../services/agents/video-agent.service';

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
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { userId, resourceType, params } = job.data;

    console.log(`[ResourceProcessor] Processing ${resourceType} for user ${userId}, job ${job.id}`);
    this.events.emitAgentStatus(userId, 'ResourceAgent', 'working', `生成 ${params.skillName || '学习路径'} 资源中`);

    try {
      let result: any;
      const jobId = String(job.id);

      switch (resourceType) {
        case 'lecture':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」讲义`);
          result = await this.resourceAgent.generateLecture(
            params.skillName,
            params.difficulty || 'beginner',
          );
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」讲义已生成`);
          this.events.emitResourceReady(userId, params.skillName, 'lecture');
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle');
          return { type: 'lecture', skill: params.skillName, generated: !!result };

        case 'quiz':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」练习题`);
          result = await this.resourceAgent.generateQuiz(
            params.skillName,
            params.count || 5,
            params.difficulty || 'beginner',
          );
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」练习题已生成`);
          this.events.emitResourceReady(userId, params.skillName, 'quiz');
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle');
          return { type: 'quiz', skill: params.skillName, count: result?.length || 0, generated: !!result };

        case 'coding':
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」编程题`);
          result = await this.resourceAgent.generateCodingProblems(
            params.skillName,
            params.count || 2,
            params.difficulty || 'beginner',
          );
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 100, `「${params.skillName}」编程题已生成`);
          this.events.emitResourceReady(userId, params.skillName, 'coding');
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle');
          return { type: 'coding', skill: params.skillName, count: result?.length || 0, generated: !!result };

        case 'reading':
          // 阅读材料复用讲义生成
          await job.updateProgress(10);
          this.events.emitAgentProgress(userId, 'ResourceAgent', jobId, 10, `正在生成「${params.skillName}」阅读材料`);
          result = await this.resourceAgent.generateLecture(
            params.skillName,
            params.difficulty || 'beginner',
          );
          await job.updateProgress(100);
          this.events.emitResourceReady(userId, params.skillName, 'reading');
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle');
          return { type: 'reading', skill: params.skillName, generated: !!result };

        case 'video': {
          await job.updateProgress(5);
          this.events.emitAgentProgress(userId, 'VideoAgent', jobId, 5, `正在生成「${params.skillName}」教学视频`);
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
              this.events.emitAgentProgress(userId, 'VideoAgent', jobId, adjustedProgress, message);
            },
          );
          await job.updateProgress(100);
          this.events.emitAgentProgress(userId, 'VideoAgent', jobId, 100, `「${params.skillName}」视频已生成`);
          this.events.emitResourceReady(userId, params.skillName, 'video');
          this.events.emitAgentStatus(userId, 'VideoAgent', 'idle');
          return { type: 'video', skill: params.skillName, generated: result.status === 'completed' };
        }

        case 'path_resources': {
          // 批量为学习路径中所有技能生成资源 — 逐技能推送进度
          await job.updateProgress(5);
          const skills = this.extractSkills(params.pathData);
          const total = skills.length || 1;
          let done = 0;
          let generated = 0;
          let skipped = 0;
          let failed = 0;

          for (const skill of skills) {
            try {
              const lecture = await this.resourceAgent.generateLecture(skill.name, skill.difficulty);
              await this.resourceAgent.generateQuiz(skill.name, 5, skill.difficulty);
              if (lecture) generated++; else skipped++;
              this.events.emitResourceReady(userId, skill.name, 'lecture');
            } catch (e: any) {
              failed++;
              console.warn(`[ResourceProcessor] path skill "${skill.name}" failed:`, e.message);
            }
            done++;
            const progress = Math.round(5 + (done / total) * 95);
            await job.updateProgress(progress);
            this.events.emitAgentProgress(
              userId, 'ResourceAgent', jobId, progress,
              `学习资源生成中 ${done}/${total}：${skill.name}`,
            );
          }

          await job.updateProgress(100);
          this.events.emitAgentStatus(userId, 'ResourceAgent', 'idle');
          return { type: 'path_resources', generated, skipped, failed, total };
        }

        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (e: any) {
      console.error(`[ResourceProcessor] Failed ${resourceType} for user ${userId}:`, e.message);
      this.events.emitAgentStatus(userId, 'ResourceAgent', 'error', e.message);
      throw e;
    }
  }

  /** 从 pathData 抽取去重技能列表（含难度） */
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
