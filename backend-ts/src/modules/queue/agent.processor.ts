import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
} from '../../services/agents';
import { EventsService } from '../events/events.service';

/**
 * Agent 任务处理器
 *
 * §23 每步通过 SSE 推送进度给前端（智能体办公室）
 */
@Processor('agent-tasks', { prefix: 'zhipath' })
export class AgentProcessor extends WorkerHost {
  constructor(
    private readonly lectureAgent: LectureAgentService,
    private readonly readingAgent: ReadingAgentService,
    private readonly codeAgent: CodeAgentService,
    private readonly pathAgent: PathAgentService,
    private readonly assessAgent: AssessAgentService,
    private readonly events: EventsService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { userId, agentType, params } = job.data;
    const jobId = String(job.id);

    console.log(`[AgentProcessor] Processing ${agentType} for user ${userId}, job ${job.id}`);
    this.events.emitAgentStatus(userId, agentType, 'working');

    try {
      let result: any;

      await job.updateProgress(10);
      this.events.emitAgentProgress(userId, agentType, jobId, 10, `${agentType} 任务开始`);

      switch (agentType) {
        case 'lecture':
          result = await this.lectureAgent.generate(params.skillName, params.level, params.extra);
          break;
        case 'reading':
          result = await this.readingAgent.generate(params.skillName, params.count, params.focus);
          break;
        case 'code':
          result = await this.codeAgent.generate(params.skillName, params.language, params.count);
          break;
        case 'path':
          result = await this.pathAgent.generate(params.goal, params.currentLevel, params.availableTime, params.preferences);
          break;
        case 'assess':
          result = await this.assessAgent.assess(params.learningData, params.goal, params.currentProgress);
          break;
        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }

      await job.updateProgress(100);
      this.events.emitAgentProgress(userId, agentType, jobId, 100, `${agentType} 任务完成`);
      this.events.emitAgentStatus(userId, agentType, 'idle');
      console.log(`[AgentProcessor] Completed ${agentType} for user ${userId}`);
      return result;
    } catch (e: any) {
      console.error(`[AgentProcessor] Failed ${agentType} for user ${userId}:`, e.message);
      this.events.emitAgentStatus(userId, agentType, 'error', e.message);
      throw e;
    }
  }
}
