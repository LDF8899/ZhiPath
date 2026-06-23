import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentTask } from '../../entities/agent-task.entity';
import { AgentProfile } from '../../entities/agent-profile.entity';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentProfileService } from '../../services/agent-profile.service';
import { AgentOfficeController } from './agent-office.controller';
import { AgentsModule } from '../agents/agents.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { EventsModule } from '../events/events.module';

/**
 * 智能体办公室模块
 * 导入 EventsModule 以支持 SSE 实时推送
 */
@Module({
  imports: [TypeOrmModule.forFeature([AgentTask, AgentProfile]), AgentsModule, KnowledgeModule, EventsModule],
  controllers: [AgentOfficeController],
  providers: [AgentTaskService, AgentProfileService],
  exports: [AgentTaskService, AgentProfileService],
})
export class AgentOfficeModule {}
