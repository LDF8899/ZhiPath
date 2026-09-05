import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../../entities/student.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { AgentProfile } from '../../entities/agent-profile.entity';
import { AgentTask } from '../../entities/agent-task.entity';
import { GeneratedResource } from '../../entities/generated-resource.entity';
import { LlmService } from '../../services/llm.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { ProfileService } from '../../services/profile.service';
import { JobSearchService } from '../../services/job-search.service';
import { SearchStackService } from '../../services/search-stack.service';
import { AgentProfileService } from '../../services/agent-profile.service';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentOfficeBridgeService } from '../../services/agent-office-bridge.service';
import { GeneratedResourceService } from '../../services/generated-resource.service';
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
import { EvidenceModule } from '../evidence/evidence.module';
import { KnowledgeIngestionModule } from '../knowledge-ingestion/knowledge-ingestion.module';
import { LearningDomainModule } from '../../domains/learning-domain.module';
import { QuestionGenerationModule } from '../question-generation/question-generation.module';
import { RemediationModule } from '../remediation/remediation.module';

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
    TypeOrmModule.forFeature([Student, JobPosition, JobApplication, LearningPlan, ExamRecord, AgentProfile, AgentTask, GeneratedResource]),
    SkillModule,
    MatchModule,
    PlannerModule,
    MultimodalModule,
    AgentsModule,
    EventsModule,
    EvidenceModule,
    KnowledgeIngestionModule,
    LearningDomainModule,
    QuestionGenerationModule,
    RemediationModule,
  ],
  controllers: [ChatController],
  providers: [
    LlmService,
    ChatHistoryService,
    ProfileService,
    JobSearchService,
    SearchStackService,
    AgentProfileService,
    AgentTaskService,
    AgentOfficeBridgeService,
    GeneratedResourceService,
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
