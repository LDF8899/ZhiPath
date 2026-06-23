/**
 * 智能体统一导出
 *
 * 使用方式：
 *   import { LectureAgentService, ReadingAgentService } from '../../services/agents';
 *
 * 或单独导入：
 *   import { LectureAgentService } from '../../services/agents/lecture-agent.service';
 */

// ── 原有 5 个 Agent ──────────────────────────────────

export { LectureAgentService } from './lecture-agent.service';
export { ReadingAgentService } from './reading-agent.service';
export { CodeAgentService } from './code-agent.service';
export { PathAgentService } from './path-agent.service';
export { AssessAgentService } from './assess-agent.service';

// ── 新增 8 个 Agent ──────────────────────────────────

export { JDParserAgentService } from './jd-parser-agent.service';
export { ReviewerAgentService } from './reviewer-agent.service';
export { ResumeAgentService } from './resume-agent.service';
export { ProfileAgentService } from './profile-agent.service';
export { ExamAgentService } from './exam-agent.service';
export { SkillGapAgentService } from './skill-gap-agent.service';
export { DailyTaskAgentService } from './daily-task-agent.service';
export { NewsAgentService } from './news-agent.service';
export { OrchestratorAgentService } from './orchestrator-agent.service';
export { VideoAgentService } from './video-agent.service';
export { AgentCacheService } from './cache.service';
export { TokenTrackerService } from './token-tracker.service';

// ── 类型导出 ──────────────────────────────────

// 原有类型
export type { LectureData, Exercise } from './lecture-agent.service';
export type { ReadingData, ReadingItem } from './reading-agent.service';
export type { CodeData, CodeExample } from './code-agent.service';
export type { PathData, PathStage } from './path-agent.service';
export type { AssessData, DimensionScore, WeakPoint, Improvement } from './assess-agent.service';

// 新增类型
export type { JDParseResult, JDSkill } from './jd-parser-agent.service';
export type { ReviewResult, ReviewIssue, AnswerVerification, ErrorAnalysis, ReinforcementPlan } from './reviewer-agent.service';
export type { ResumeData, UserProfile, TargetJob, ResumeSection } from './resume-agent.service';
export type { ProfileReport, Achievement, LearningPattern, Recommendation } from './profile-agent.service';
export type { ExamData, ExamQuestion, ExamConfig, QuickTestConfig } from './exam-agent.service';
export type { SkillGapReport, GapSkill, MatchedSkill, GapAnalysis, ImprovementPlan } from './skill-gap-agent.service';
export type { DailyTaskOutput, TaskItem, DailyTaskInput } from './daily-task-agent.service';
export type { NewsArticle, TechTrend, TrendItem, HotSkill, PersonalizedNews } from './news-agent.service';
export type { IntentResult, IntentType, AgentTask, OrchestrationResult } from './orchestrator-agent.service';
export type { VideoScript, VideoSegment, VideoAgentInput, VideoAgentOutput, SegmentType } from './video-agent.types';
