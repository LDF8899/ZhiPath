import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { LearningPlan } from '../../entities/learning.entity';
import { AgentTask } from '../../entities/agent-task.entity';
import { AgentProfile } from '../../entities/agent-profile.entity';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentsModule } from '../agents/agents.module';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentProfileService } from '../../services/agent-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([LearningPlan, AgentTask, AgentProfile]), KnowledgeModule, AgentsModule],
  controllers: [LearningPathsController],
  providers: [LearningPathsService, AgentTaskService, AgentProfileService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
