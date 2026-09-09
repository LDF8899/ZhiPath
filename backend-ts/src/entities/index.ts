/**
 * 实体统一导出 — v2 重构版
 * 17 张表，14 个实体文件
 */

// 用户
export { User } from './user.entity';

// 学生画像（个人中心数据中枢）
export { Student } from './student.entity';

// 用户技能（技能模型 §6：百分比+信任度+衰减）
export { UserSkill } from './user-skills.entity';

// 学习计划（多计划+Git分支 §2）
export { LearningPlan } from './learning.entity';

// 学习任务（任务状态机 §16）
export { LearningTask } from './learning-tasks.entity';

// 学习会话（Git commit 模型 §11）
export { LearningSession } from './learning-sessions.entity';

// 岗位 + 投递
export { JobPosition, JobApplication } from './job.entity';

// 考试题库 + 记录
export { ExamQuestion, ExamRecord } from './exam.entity';

// 资讯
export { News } from './news.entity';

// 简历（多版本 Git 模型）
export { Resume } from './resume.entity';

// 企业
export { Enterprise } from './enterprise.entity';

// 通知
export { Notification } from './notification.entity';

// 知识库
export { KnowledgeBase } from './knowledge.entity';

// 系统配置 + 操作日志
export { SystemConfig, OperationLog } from './system.entity';

// 匹配度历史记录
export { MatchHistory } from './match-history.entity';

// 课程章节（树形结构）
export { CourseChapter } from './course-chapter.entity';

// 课程能力项
export { CourseAbility } from './course-ability.entity';
export { EvaluationRubric } from './evaluation-rubric.entity';
export { EvaluationAttempt } from './evaluation-attempt.entity';
export { EvaluationEvidence } from './evaluation-evidence.entity';
export { EvaluationResult } from './evaluation-result.entity';
export { EvaluationDimensionScore } from './evaluation-dimension-score.entity';
export { EvaluationImpact } from './evaluation-impact.entity';

// 多前端平台控制面
export { ClientApp } from './client-app.entity';
export { ClientFeature } from './client-feature.entity';
export { Tenant } from './tenant.entity';
export { TenantMembership } from './tenant-membership.entity';
export { PlatformRole } from './platform-role.entity';
export { PlatformPermission } from './platform-permission.entity';
export { RolePermission } from './role-permission.entity';
export { UserClientPreference } from './user-client-preference.entity';
export { RefreshToken } from './refresh-token.entity';
export { QuestionBankImport } from './question-bank-import.entity';
export { QuestionBankImportCandidate } from './question-bank-import-candidate.entity';
