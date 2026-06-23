import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmService } from '../../services/llm.service';
import {
  // 基础服务
  AgentCacheService,
  TokenTrackerService,
  // 原有 5 个
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
  // 新增 8 个
  JDParserAgentService,
  ReviewerAgentService,
  ResumeAgentService,
  ProfileAgentService,
  ExamAgentService,
  SkillGapAgentService,
  DailyTaskAgentService,
  NewsAgentService,
  OrchestratorAgentService,
  // 视频生成
  VideoAgentService,
} from '../../services/agents';
import { TtsService } from '../../services/tts.service';
import { VideoRenderService } from '../../services/video-render.service';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentTask } from '../../entities/agent-task.entity';
import { ExamQuestion } from '../../entities/exam.entity';
import { AgentsController } from './agents.controller';
import { AgentsTestController } from './agents-test.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

/**
 * Agents 模块 — 13 个智能体
 *
 * 原有（内容生成）：
 * 1.  LectureAgentService   — 讲义生成
 * 2.  ReadingAgentService   — 拓展阅读
 * 3.  CodeAgentService      — 代码案例
 * 4.  PathAgentService      — 学习路径（LLM 版）
 * 5.  AssessAgentService    — 学习评估
 *
 * 新增（业务智能体）：
 * 6.  JDParserAgentService  — 岗位 JD 解析
 * 7.  ReviewerAgentService  — 质量审查 + 错题分析
 * 8.  ResumeAgentService    — 简历生成
 * 9.  ProfileAgentService   — 用户画像分析
 * 10. ExamAgentService      — 考试出题
 * 11. SkillGapAgentService  — 技能差距分析
 * 12. DailyTaskAgentService — 每日任务调度
 * 13. NewsAgentService      — 资讯生成
 * 14. OrchestratorAgentService — 中控智能体（意图识别 + 任务编排）
 */
@Module({
  imports: [KnowledgeModule, TypeOrmModule.forFeature([AgentTask, ExamQuestion])],
  controllers: [AgentsController, AgentsTestController],
  providers: [
    // 基础服务
    LlmService,
    AgentCacheService,
    TokenTrackerService,
    AgentTaskService,
    // 原有
    LectureAgentService,
    ReadingAgentService,
    CodeAgentService,
    PathAgentService,
    AssessAgentService,
    // 新增
    JDParserAgentService,
    ReviewerAgentService,
    ResumeAgentService,
    ProfileAgentService,
    ExamAgentService,
    SkillGapAgentService,
    DailyTaskAgentService,
    NewsAgentService,
    // 中控
    OrchestratorAgentService,
    // 视频生成
    VideoAgentService,
    TtsService,
    VideoRenderService,
  ],
  exports: [
    // 基础服务
    AgentCacheService,
    TokenTrackerService,
    AgentTaskService,
    // 原有
    LectureAgentService,
    ReadingAgentService,
    CodeAgentService,
    PathAgentService,
    AssessAgentService,
    // 新增
    JDParserAgentService,
    ReviewerAgentService,
    ResumeAgentService,
    ProfileAgentService,
    ExamAgentService,
    SkillGapAgentService,
    DailyTaskAgentService,
    NewsAgentService,
    // 中控
    OrchestratorAgentService,
    // 视频生成
    VideoAgentService,
    TtsService,
    VideoRenderService,
  ],
})
export class AgentsModule {}
