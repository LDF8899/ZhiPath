import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../../entities/student.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { LlmService } from '../../services/llm.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { ProfileService } from '../../services/profile.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { IntentRouterService } from './intent-router.service';
import { ActionExecutorService } from './action-executor.service';
import { TutorPromptService } from './tutor-prompt.service';
import { AgentEngineService } from './agent-engine.service';
import { LangGraphEngineService } from './langgraph-engine.service';
import { SkillModule } from '../skill/skill.module';
import { MatchModule } from '../match/match.module';
import { PlannerModule } from '../planner/planner.module';
import { MultimodalModule } from '../multimodal/multimodal.module';
import { AgentsModule } from '../agents/agents.module';
import { EventsModule } from '../events/events.module';

/**
 * Chat 模块 — Phase 6 核心模块
 *
 * 包含：意图路由、动作执行、AI助教提示词、Agent引擎、对话历史
 * 支持两种编排模式：
 *   1. AgentEngineService - 简化版直接调用
 *   2. LangGraphEngineService - LangGraph 状态图编排
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, JobPosition, JobApplication, LearningPlan, ExamRecord]),
    SkillModule,
    MatchModule,
    PlannerModule,
    MultimodalModule,
    AgentsModule,
    EventsModule,
  ],
  controllers: [ChatController],
  providers: [
    LlmService,
    ChatHistoryService,
    ProfileService,
    IntentRouterService,
    ActionExecutorService,
    TutorPromptService,
    AgentEngineService,
    LangGraphEngineService,
    ChatService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
