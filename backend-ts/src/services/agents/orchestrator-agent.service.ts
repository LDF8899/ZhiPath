import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { AgentCacheService } from './cache.service';
import { TokenTrackerService } from './token-tracker.service';
import { extractJson } from '../../common/json-repair';
import {
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
  JDParserAgentService,
  ReviewerAgentService,
  ResumeAgentService,
  ProfileAgentService,
  ExamAgentService,
  SkillGapAgentService,
  DailyTaskAgentService,
  NewsAgentService,
} from './index';

/**
 * 中控智能体（OrchestratorAgent）
 *
 * 核心职责：
 * 1. 意图识别 — 理解用户自然语言请求
 * 2. 任务编排 — 决定调用哪些子智能体、执行顺序
 * 3. 结果汇总 — 合并多个子智能体的输出
 * 4. 异常处理 — 子智能体失败时的降级策略
 *
 * 优化：
 * - 改进意图识别准确率
 * - 支持多轮对话上下文
 * - 添加回退策略
 * - Token 追踪
 */

// ── 意图类型 ──────────────────────────────────

export type IntentType =
  | 'generate_lecture'        // 生成讲义
  | 'generate_reading'        // 生成拓展阅读
  | 'generate_code'           // 生成代码案例
  | 'generate_path'           // 生成学习路径
  | 'assess_learning'         // 评估学习效果
  | 'parse_jd'                // 解析岗位 JD
  | 'review_content'          // 审查内容质量
  | 'generate_resume'         // 生成简历
  | 'analyze_profile'         // 分析用户画像
  | 'generate_exam'           // 生成考试
  | 'analyze_skill_gap'       // 分析技能差距
  | 'get_daily_tasks'         // 获取每日任务
  | 'get_news'                // 获取资讯
  | 'prepare_interview'       // 面试准备（复合）
  | 'start_learning'          // 开始学习（复合）
  | 'check_match'             // 检查匹配度（复合）
  | 'help'                    // 帮助
  | 'unknown';                // 未知意图

// ── 意图识别结果 ──────────────────────────────────

export interface IntentResult {
  intent: IntentType;
  confidence: number;          // 0-1
  entities: Record<string, any>;  // 提取的实体
  rawQuery: string;            // 原始查询
  conversationContext?: any;   // 对话上下文
}

// ── 任务定义 ──────────────────────────────────

export interface AgentTask {
  id: string;
  agent: string;               // 智能体名称
  action: string;              // 动作
  params: Record<string, any>; // 参数
  priority: number;            // 优先级 1-10
  dependsOn?: string[];        // 依赖的任务 ID
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

// ── 编排结果 ──────────────────────────────────

export interface OrchestrationResult {
  intent: IntentType;
  success: boolean;
  tasks: AgentTask[];
  summary: string;             // 汇总结果（用户可读）
  data: any;                   // 结构化数据
  suggestions?: string[];      // 后续建议
  _usage?: {
    intentTokens: number;
    totalTokens: number;
    durationMs: number;
  };
}

@Injectable()
export class OrchestratorAgentService {
  constructor(
    private llmService: LlmService,
    private cacheService: AgentCacheService,
    private tokenTracker: TokenTrackerService,
    private lectureAgent: LectureAgentService,
    private readingAgent: ReadingAgentService,
    private codeAgent: CodeAgentService,
    private pathAgent: PathAgentService,
    private assessAgent: AssessAgentService,
    private jdParserAgent: JDParserAgentService,
    private reviewerAgent: ReviewerAgentService,
    private resumeAgent: ResumeAgentService,
    private profileAgent: ProfileAgentService,
    private examAgent: ExamAgentService,
    private skillGapAgent: SkillGapAgentService,
    private dailyTaskAgent: DailyTaskAgentService,
    private newsAgent: NewsAgentService,
  ) {}

  /**
   * 处理用户请求（主入口）
   * @param query 用户自然语言请求
   * @param context 上下文信息
   */
  async handleRequest(
    query: string,
    context?: {
      userId?: number;
      userProfile?: any;
      currentPlan?: any;
      targetJob?: any;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    try {
      // 1. 意图识别
      const intent = await this.recognizeIntent(query, context);

      // 2. 根据意图执行任务
      let result: OrchestrationResult;

      switch (intent.intent) {
        case 'generate_lecture':
          result = await this.executeGenerateLecture(intent, context);
          break;
        case 'generate_reading':
          result = await this.executeGenerateReading(intent, context);
          break;
        case 'generate_code':
          result = await this.executeGenerateCode(intent, context);
          break;
        case 'generate_path':
          result = await this.executeGeneratePath(intent, context);
          break;
        case 'assess_learning':
          result = await this.executeAssessLearning(intent, context);
          break;
        case 'parse_jd':
          result = await this.executeParseJD(intent, context);
          break;
        case 'generate_resume':
          result = await this.executeGenerateResume(intent, context);
          break;
        case 'analyze_profile':
          result = await this.executeAnalyzeProfile(intent, context);
          break;
        case 'generate_exam':
          result = await this.executeGenerateExam(intent, context);
          break;
        case 'analyze_skill_gap':
          result = await this.executeAnalyzeSkillGap(intent, context);
          break;
        case 'get_daily_tasks':
          result = await this.executeGetDailyTasks(intent, context);
          break;
        case 'get_news':
          result = await this.executeGetNews(intent, context);
          break;
        case 'prepare_interview':
          result = await this.executePrepareInterview(intent, context);
          break;
        case 'start_learning':
          result = await this.executeStartLearning(intent, context);
          break;
        case 'check_match':
          result = await this.executeCheckMatch(intent, context);
          break;
        case 'review_content':
          result = await this.executeReviewContent(intent, context);
          break;
        case 'help':
          result = this.handleHelp();
          break;
        default:
          result = this.handleUnknownIntent(query);
      }

      // 3. 添加用量信息
      result._usage = {
        intentTokens: 0, // 需要从意图识别中获取
        totalTokens: 0,
        durationMs: Date.now() - startTime,
      };

      return result;
    } catch (error: any) {
      console.error('[OrchestratorAgent] handleRequest failed:', error.message);
      return {
        intent: 'unknown',
        success: false,
        tasks: [],
        summary: `请求处理失败：${error.message}`,
        data: null,
        suggestions: ['请稍后重试', '如果问题持续，请联系管理员'],
        _usage: {
          intentTokens: 0,
          totalTokens: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  // ── 意图识别（优化版） ──────────────────────────────────

  async recognizeIntent(query: string, context?: any): Promise<IntentResult> {
    // 关键词预匹配（快速路径）
    const quickMatch = this.quickIntentMatch(query);
    if (quickMatch && quickMatch.confidence > 0.9) {
      return {
        ...quickMatch,
        rawQuery: query,
        conversationContext: context?.conversationHistory,
      };
    }

    // LLM 意图识别（精确路径）
    const messages = this.buildIntentPrompt(query, context);
    const startTime = Date.now();

    let raw: string;
    try {
      raw = await this.llmService.chatCompletion(messages, {
        temperature: 0.2,
        maxTokens: 1024,
        tier: 'flash',
      });
    } catch (error: any) {
      console.error('[OrchestratorAgent] LLM chatCompletion failed:', error.message);
      return {
        intent: quickMatch?.intent || 'unknown',
        confidence: quickMatch?.confidence || 0.3,
        entities: quickMatch?.entities || {},
        rawQuery: query,
        conversationContext: context?.conversationHistory,
      };
    }

    const durationMs = Date.now() - startTime;

    // 记录 token 用量
    this.tokenTracker.record({
      agent: 'OrchestratorAgent',
      action: 'recognizeIntent',
      inputTokens: 0, // 需要从 LlmService 获取
      outputTokens: 0,
      totalTokens: 0,
      model: this.llmService.getModelName(),
      tier: 'flash',
      timestamp: Date.now(),
      durationMs,
    });

    try {
      const data = extractJson(raw);
      const intent = this.validIntent(data.intent) ? data.intent : 'unknown';

      return {
        intent,
        confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.5)),
        entities: this.sanitizeEntities(data.entities || {}, intent),
        rawQuery: query,
        conversationContext: context?.conversationHistory,
      };
    } catch (e) {
      console.error('[OrchestratorAgent] JSON parse failed:', e.message);
      // 解析失败时回退到关键词匹配
      return {
        intent: quickMatch?.intent || 'unknown',
        confidence: quickMatch?.confidence || 0.3,
        entities: quickMatch?.entities || {},
        rawQuery: query,
        conversationContext: context?.conversationHistory,
      };
    }
  }

  /**
   * 关键词快速匹配（不调用 LLM）
   */
  private quickIntentMatch(query: string): Omit<IntentResult, 'rawQuery' | 'conversationContext'> | null {
    const q = query.toLowerCase();

    // 帮助
    if (q.includes('帮助') || q === 'help' || q === '?') {
      return { intent: 'help', confidence: 1, entities: {} };
    }

    // 讲义生成
    if (q.includes('讲义') || q.includes('教程') || q.includes('学习资料')) {
      const skillMatch = q.match(/(?:生成|创建|写|做).*?([一-龥a-zA-Z+]+?)(?:讲义|教程|学习资料)/);
      return {
        intent: 'generate_lecture',
        confidence: 0.95,
        entities: { skillName: skillMatch?.[1]?.trim() || this.extractSkillName(q) },
      };
    }

    // 考试
    if (q.includes('考试') || q.includes('测试') || q.includes('做题')) {
      const skillMatch = q.match(/(?:生成|创建|做).*?([一-龥a-zA-Z+]+?)(?:考试|测试|题目)/);
      return {
        intent: 'generate_exam',
        confidence: 0.95,
        entities: { skillName: skillMatch?.[1]?.trim() || this.extractSkillName(q) },
      };
    }

    // 学习路径
    if (q.includes('学习路径') || q.includes('学习计划') || q.includes('学习路线')) {
      const goalMatch = q.match(/(?:生成|创建|制定).*?([一-龥a-zA-Z+]+?)(?:学习路径|学习计划|学习路线)/);
      return {
        intent: 'generate_path',
        confidence: 0.95,
        entities: { goal: goalMatch?.[1]?.trim() || this.extractSkillName(q) },
      };
    }

    // 简历
    if (q.includes('简历') || q.includes('resume')) {
      return { intent: 'generate_resume', confidence: 0.95, entities: {} };
    }

    // 技能差距
    if (q.includes('差距') || q.includes('匹配') || q.includes('差距分析')) {
      return { intent: 'analyze_skill_gap', confidence: 0.9, entities: {} };
    }

    // 面试准备
    if (q.includes('面试') || q.includes('准备面试')) {
      return { intent: 'prepare_interview', confidence: 0.9, entities: {} };
    }

    // 每日任务
    if (q.includes('今日任务') || q.includes('今天学什么') || q.includes('每日任务')) {
      return { intent: 'get_daily_tasks', confidence: 0.95, entities: {} };
    }

    // 资讯
    if (q.includes('资讯') || q.includes('新闻') || q.includes('趋势')) {
      return { intent: 'get_news', confidence: 0.9, entities: {} };
    }

    return null;
  }

  /**
   * 从查询中提取技能名称
   */
  private extractSkillName(query: string): string {
    // 常见技能关键词
    const skills = [
      'react', 'vue', 'angular', 'node', 'javascript', 'typescript',
      'python', 'java', 'go', 'rust', 'c++', 'c#',
      'html', 'css', 'sass', 'less',
      'webpack', 'vite', 'docker', 'kubernetes',
      'mysql', 'redis', 'mongodb', 'postgresql',
      'git', 'linux', 'aws', 'azure',
    ];

    const q = query.toLowerCase();
    for (const skill of skills) {
      if (q.includes(skill)) {
        return skill.charAt(0).toUpperCase() + skill.slice(1);
      }
    }

    return '未知技能';
  }

  /**
   * 清理和验证实体
   */
  private sanitizeEntities(entities: Record<string, any>, intent: IntentType): Record<string, any> {
    const sanitized = { ...entities };

    // 根据意图设置默认值
    switch (intent) {
      case 'generate_lecture':
        sanitized.skillName = sanitized.skillName || sanitized.skill || '未知技能';
        sanitized.level = ['beginner', 'intermediate', 'advanced'].includes(sanitized.level)
          ? sanitized.level : 'beginner';
        break;

      case 'generate_exam':
        sanitized.skillName = sanitized.skillName || sanitized.skill || '未知技能';
        sanitized.difficulty = ['basic', 'intermediate', 'advanced', 'mixed'].includes(sanitized.difficulty)
          ? sanitized.difficulty : 'mixed';
        sanitized.questionCount = Math.min(50, Math.max(1, Number(sanitized.questionCount) || 10));
        break;

      case 'generate_path':
        sanitized.goal = sanitized.goal || sanitized.target || '学习目标';
        sanitized.currentLevel = sanitized.currentLevel || '零基础';
        break;

      case 'generate_reading':
        sanitized.skillName = sanitized.skillName || sanitized.skill || '未知技能';
        sanitized.count = Math.min(10, Math.max(1, Number(sanitized.count) || 5));
        break;

      case 'generate_code':
        sanitized.skillName = sanitized.skillName || sanitized.skill || '未知技能';
        sanitized.language = sanitized.language || 'JavaScript';
        sanitized.count = Math.min(10, Math.max(1, Number(sanitized.count) || 3));
        break;
    }

    return sanitized;
  }

  // ── 意图识别 Prompt（优化版） ──────────────────────────────────

  private buildIntentPrompt(query: string, context?: any): { role: string; content: string }[] {
    const conversationContext = context?.conversationHistory?.length
      ? `\n对话历史：\n${context.conversationHistory.slice(-3).map((m: any) => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    return [
      {
        role: 'system',
        content: `你是意图识别专家，分析用户请求并提取意图和实体。

支持的意图：
- generate_lecture: 生成讲义（实体：skillName, level, extra）
- generate_reading: 生成拓展阅读（实体：skillName, count, focus）
- generate_code: 生成代码案例（实体：skillName, language, count）
- generate_path: 生成学习路径（实体：goal, currentLevel, availableTime）
- assess_learning: 评估学习效果（实体：learningData, goal）
- parse_jd: 解析岗位 JD（实体：jdText）
- review_content: 审查内容质量（实体：contentType, content）
- generate_resume: 生成简历（实体：targetJob）
- analyze_profile: 分析用户画像（实体：period）
- generate_exam: 生成考试（实体：skillName, difficulty, questionCount）
- analyze_skill_gap: 分析技能差距（实体：targetJob）
- get_daily_tasks: 获取每日任务（实体：date）
- get_news: 获取资讯（实体：skills, category）
- prepare_interview: 面试准备（实体：jobTitle, skills）
- start_learning: 开始学习（实体：skillName, level）
- check_match: 检查匹配度（实体：targetJob）
- help: 帮助
- unknown: 无法识别

实体提取规则：
1. skillName：从请求中提取技能名称（如"React Hooks"、"Python"、"Vue"）
2. level：beginner/intermediate/advanced（默认 beginner）
3. difficulty：basic/intermediate/advanced/mixed（默认 mixed）
4. 数字：提取数字作为 count、questionCount 等

输出严格 JSON：
{
  "intent": "generate_lecture",
  "confidence": 0.95,
  "entities": {
    "skillName": "React Hooks",
    "level": "beginner"
  }
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请识别以下用户请求的意图：
${context?.userProfile ? `\n用户画像：${JSON.stringify(context.userProfile).substring(0, 500)}` : ''}
${context?.targetJob ? `\n目标岗位：${context.targetJob.title}` : ''}
${conversationContext}

用户请求：${query}`,
      },
    ];
  }

  private validIntent(intent: string): boolean {
    const validIntents: IntentType[] = [
      'generate_lecture', 'generate_reading', 'generate_code', 'generate_path',
      'assess_learning', 'parse_jd', 'review_content', 'generate_resume',
      'analyze_profile', 'generate_exam', 'analyze_skill_gap', 'get_daily_tasks',
      'get_news', 'prepare_interview', 'start_learning', 'check_match', 'help',
    ];
    return validIntents.includes(intent as IntentType);
  }

  // ── 帮助 ──────────────────────────────────

  private handleHelp(): OrchestrationResult {
    return {
      intent: 'help',
      success: true,
      tasks: [],
      summary: '我可以帮你完成以下任务：',
      data: null,
      suggestions: [
        '📖 生成讲义 —「帮我生成 React Hooks 讲义」',
        '📝 生成考试 —「生成 10 道 TypeScript 考试题」',
        '🗺️ 学习路径 —「制定前端开发学习路径」',
        '📄 生成简历 —「帮我生成简历」',
        '📊 技能差距 —「分析我和前端岗位的差距」',
        '📅 今日任务 —「今天学什么？」',
        '📰 技术资讯 —「前端最新趋势」',
        '🎯 面试准备 —「帮我准备前端面试」',
      ],
    };
  }

  // ── 任务执行器 ──────────────────────────────────

  private async executeGenerateLecture(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skillName, level = 'beginner', extra } = intent.entities;

    try {
      const result = await this.lectureAgent.generate(skillName, level, extra);
      return {
        intent: 'generate_lecture',
        success: true,
        tasks: [{ id: '1', agent: 'LectureAgent', action: 'generate', params: intent.entities, priority: 5, status: 'completed', result }],
        summary: `已生成「${skillName}」讲义，共 ${result.wordCount} 字，${result.exercises.length} 道练习题`,
        data: result,
        suggestions: ['需要生成配套的练习题吗？', '需要生成拓展阅读材料吗？'],
      };
    } catch (e: any) {
      return this.handleError('generate_lecture', e.message);
    }
  }

  private async executeGenerateReading(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skillName, count = 5, focus } = intent.entities;

    try {
      const result = await this.readingAgent.generate(skillName, count, focus);
      return {
        intent: 'generate_reading',
        success: true,
        tasks: [{ id: '1', agent: 'ReadingAgent', action: 'generate', params: intent.entities, priority: 5, status: 'completed', result }],
        summary: `已生成「${skillName}」${result.totalItems} 篇拓展阅读`,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('generate_reading', e.message);
    }
  }

  private async executeGenerateCode(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skillName, language = 'JavaScript', count = 3 } = intent.entities;

    try {
      const result = await this.codeAgent.generate(skillName, language, count);
      return {
        intent: 'generate_code',
        success: true,
        tasks: [{ id: '1', agent: 'CodeAgent', action: 'generate', params: intent.entities, priority: 5, status: 'completed', result }],
        summary: `已生成「${skillName}」${result.totalExamples} 个 ${language} 代码案例`,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('generate_code', e.message);
    }
  }

  private async executeGeneratePath(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { goal, currentLevel = '零基础', availableTime = '每天2小时', preferences } = intent.entities;

    try {
      const result = await this.pathAgent.generate(goal, currentLevel, availableTime, preferences);
      return {
        intent: 'generate_path',
        success: true,
        tasks: [{ id: '1', agent: 'PathAgent', action: 'generate', params: intent.entities, priority: 8, status: 'completed', result }],
        summary: `已生成「${goal}」学习路径，共 ${result.stages.length} 个阶段，预计 ${result.totalDuration}`,
        data: result,
        suggestions: ['需要为每个技能生成学习资源吗？', '需要设置为目标计划吗？'],
      };
    } catch (e: any) {
      return this.handleError('generate_path', e.message);
    }
  }

  private async executeAssessLearning(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { learningData, goal = '掌握技术栈', currentProgress = '学习中' } = intent.entities;

    try {
      const result = await this.assessAgent.assess(learningData, goal, currentProgress);
      return {
        intent: 'assess_learning',
        success: true,
        tasks: [{ id: '1', agent: 'AssessAgent', action: 'assess', params: intent.entities, priority: 5, status: 'completed', result }],
        summary: `学习评估完成，总分 ${result.overallScore}，等级「${result.level}」`,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('assess_learning', e.message);
    }
  }

  private async executeParseJD(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { jdText, title, company } = intent.entities;

    try {
      const result = await this.jdParserAgent.parse(jdText, { title, company });
      return {
        intent: 'parse_jd',
        success: true,
        tasks: [{ id: '1', agent: 'JDParserAgent', action: 'parse', params: intent.entities, priority: 7, status: 'completed', result }],
        summary: `JD 解析完成，提取 ${result.requiredSkills.length} 个必须技能，${result.preferredSkills.length} 个加分技能`,
        data: result,
        suggestions: result.suggestions,
      };
    } catch (e: any) {
      return this.handleError('parse_jd', e.message);
    }
  }

  private async executeGenerateResume(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { targetJob } = intent.entities;

    if (!context?.userProfile) {
      return {
        intent: 'generate_resume',
        success: false,
        tasks: [],
        summary: '无法生成简历，请先完善个人中心信息',
        data: null,
        suggestions: ['前往个人中心完善技能、项目经历等信息'],
      };
    }

    try {
      const result = await this.resumeAgent.generate(context.userProfile, targetJob);
      return {
        intent: 'generate_resume',
        success: true,
        tasks: [{ id: '1', agent: 'ResumeAgent', action: 'generate', params: intent.entities, priority: 6, status: 'completed', result }],
        summary: `简历已生成，针对「${targetJob.title}」岗位优化`,
        data: result,
        suggestions: ['需要导出 PDF 吗？', '需要生成投递邮件摘要吗？'],
      };
    } catch (e: any) {
      return this.handleError('generate_resume', e.message);
    }
  }

  private async executeAnalyzeProfile(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { period = 'week' } = intent.entities;

    // 这里需要从数据库获取学习数据，简化处理
    const learningData = intent.entities.learningData || context?.learningData;

    if (!learningData) {
      return {
        intent: 'analyze_profile',
        success: false,
        tasks: [],
        summary: '暂无学习数据，请先开始学习',
        data: null,
      };
    }

    try {
      const result = await this.profileAgent.generateReport(learningData);
      return {
        intent: 'analyze_profile',
        success: true,
        tasks: [{ id: '1', agent: 'ProfileAgent', action: 'generateReport', params: intent.entities, priority: 4, status: 'completed', result }],
        summary: result.summary,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('analyze_profile', e.message);
    }
  }

  private async executeGenerateExam(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skillName, difficulty = 'mixed', questionCount = 10, questionTypes = ['choice'] } = intent.entities;

    try {
      const result = await this.examAgent.generateExam({
        skillName,
        difficulty,
        questionCount,
        questionTypes,
      });
      return {
        intent: 'generate_exam',
        success: true,
        tasks: [{ id: '1', agent: 'ExamAgent', action: 'generateExam', params: intent.entities, priority: 7, status: 'completed', result }],
        summary: `已生成「${skillName}」考试，共 ${result.totalQuestions} 道题，限时 ${Math.round(result.totalTimeLimit / 60)} 分钟`,
        data: result,
        suggestions: ['需要开始考试吗？'],
      };
    } catch (e: any) {
      return this.handleError('generate_exam', e.message);
    }
  }

  private async executeAnalyzeSkillGap(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { targetJob } = intent.entities;
    const userSkills = intent.entities.userSkills || context?.userProfile?.skills || [];

    if (!userSkills.length) {
      return {
        intent: 'analyze_skill_gap',
        success: false,
        tasks: [],
        summary: '暂无技能数据，请先完善个人中心的技能信息',
        data: null,
        suggestions: ['前往个人中心添加技能'],
      };
    }

    try {
      const result = await this.skillGapAgent.analyze({
        userSkills,
        targetJob,
      });
      return {
        intent: 'analyze_skill_gap',
        success: true,
        tasks: [{ id: '1', agent: 'SkillGapAgent', action: 'analyze', params: intent.entities, priority: 8, status: 'completed', result }],
        summary: `匹配度 ${result.matchScore}%，${result.canApply ? '可以投递' : '还需提升 ' + result.gapAnalysis.gapCount + ' 个技能'}`,
        data: result,
        suggestions: result.suggestions,
      };
    } catch (e: any) {
      return this.handleError('analyze_skill_gap', e.message);
    }
  }

  private async executeGetDailyTasks(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { date = new Date().toISOString().split('T')[0] } = intent.entities;

    if (!context?.currentPlan) {
      return {
        intent: 'get_daily_tasks',
        success: false,
        tasks: [],
        summary: '暂无学习计划，请先创建计划',
        data: null,
        suggestions: ['创建学习计划后即可获取每日任务'],
      };
    }

    try {
      const result = await this.dailyTaskAgent.generateTasks({
        userId: context.userId || 0,
        date,
        availableMinutes: intent.entities.availableMinutes || 120,
        mainlineRatio: intent.entities.mainlineRatio || 0.8,
        currentPath: context.currentPlan,
        sidePaths: intent.entities.sidePaths,
        recentHistory: context.recentHistory,
      });
      return {
        intent: 'get_daily_tasks',
        success: true,
        tasks: [{ id: '1', agent: 'DailyTaskAgent', action: 'generateTasks', params: intent.entities, priority: 9, status: 'completed', result }],
        summary: `今日 ${result.mainlineTasks.length} 个主线任务 + ${result.sideTasks.length} 个支线任务，预计 ${result.totalEstimatedMinutes} 分钟`,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('get_daily_tasks', e.message);
    }
  }

  private async executeGetNews(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skills, category, count = 10 } = intent.entities;
    const skillsList = Array.isArray(skills) ? skills : (skills ? [skills] : []);

    try {
      const result = await this.newsAgent.generateTrendAnalysis(skillsList);
      return {
        intent: 'get_news',
        success: true,
        tasks: [{ id: '1', agent: 'NewsAgent', action: 'generateTrendAnalysis', params: intent.entities, priority: 3, status: 'completed', result }],
        summary: result.summary,
        data: result,
      };
    } catch (e: any) {
      return this.handleError('get_news', e.message);
    }
  }

  // ── 复合任务执行器 ──────────────────────────────────

  /**
   * 面试准备（复合任务）
   * 1. 分析技能差距
   * 2. 生成考试题
   * 3. 生成面试常见问题
   */
  private async executePrepareInterview(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { jobTitle, skills = [] } = intent.entities;
    const tasks: AgentTask[] = [];

    try {
      // 确保 skills 是数组
      const skillsList = Array.isArray(skills) ? skills : [];

      // 任务 1：技能差距分析
      const gapTask: AgentTask = {
        id: 'gap',
        agent: 'SkillGapAgent',
        action: 'analyze',
        params: { targetJob: intent.entities.targetJob },
        priority: 10,
        status: 'running',
      };
      tasks.push(gapTask);

      const gapResult = await this.skillGapAgent.analyze({
        userSkills: context?.userProfile?.skills || [],
        targetJob: intent.entities.targetJob || {
          title: jobTitle || '目标岗位',
          requiredSkills: skillsList.map((s: string) => ({ name: s, weight: 1, minLevel: 60 })),
          preferredSkills: [],
        },
      });
      gapTask.status = 'completed';
      gapTask.result = gapResult;

      // 任务 2：生成考试题（依赖任务 1）
      const examTask: AgentTask = {
        id: 'exam',
        agent: 'ExamAgent',
        action: 'generateJobExam',
        params: { jobTitle, requiredSkills: skillsList },
        priority: 9,
        dependsOn: ['gap'],
        status: 'running',
      };
      tasks.push(examTask);

      const examResult = await this.examAgent.generateJobExam(jobTitle || '目标岗位', skillsList);
      examTask.status = 'completed';
      examTask.result = examResult;

      return {
        intent: 'prepare_interview',
        success: true,
        tasks,
        summary: `面试准备完成：匹配度 ${gapResult.matchScore}%，已生成 ${examResult.totalQuestions} 道面试题`,
        data: {
          skillGap: gapResult,
          exam: examResult,
        },
        suggestions: [
          `关键差距：${gapResult.gapAnalysis.criticalGaps.join('、') || '无'}`,
          '建议先补强关键差距，再做模拟面试',
          '需要生成简历吗？',
        ],
      };
    } catch (e: any) {
      return this.handleError('prepare_interview', e.message);
    }
  }

  /**
   * 开始学习（复合任务）
   * 1. 生成讲义
   * 2. 生成拓展阅读
   * 3. 生成代码案例
   */
  private async executeStartLearning(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { skillName, level = 'beginner' } = intent.entities;
    const tasks: AgentTask[] = [];

    try {
      // 并行生成三种资源
      const [lecture, reading, code] = await Promise.all([
        this.lectureAgent.generate(skillName, level).then(r => {
          tasks.push({ id: 'lecture', agent: 'LectureAgent', action: 'generate', params: intent.entities, priority: 5, status: 'completed', result: r });
          return r;
        }),
        this.readingAgent.generate(skillName, 3).then(r => {
          tasks.push({ id: 'reading', agent: 'ReadingAgent', action: 'generate', params: intent.entities, priority: 4, status: 'completed', result: r });
          return r;
        }),
        this.codeAgent.generate(skillName, 'JavaScript', 2).then(r => {
          tasks.push({ id: 'code', agent: 'CodeAgent', action: 'generate', params: intent.entities, priority: 4, status: 'completed', result: r });
          return r;
        }),
      ]);

      return {
        intent: 'start_learning',
        success: true,
        tasks,
        summary: `「${skillName}」学习资源已就绪：讲义 ${lecture.wordCount} 字 + ${reading.totalItems} 篇阅读 + ${code.totalExamples} 个代码案例`,
        data: { lecture, reading, code },
        suggestions: ['建议先阅读讲义，再做练习题', '需要生成考试检测掌握程度吗？'],
      };
    } catch (e: any) {
      return this.handleError('start_learning', e.message);
    }
  }

  /**
   * 检查匹配度（复合任务）
   * 1. 分析技能差距
   * 2. 生成提升建议
   */
  private async executeCheckMatch(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { targetJob } = intent.entities;

    try {
      const result = await this.skillGapAgent.analyze({
        userSkills: context?.userProfile?.skills || [],
        targetJob,
      });

      return {
        intent: 'check_match',
        success: true,
        tasks: [{ id: 'gap', agent: 'SkillGapAgent', action: 'analyze', params: intent.entities, priority: 8, status: 'completed', result }],
        summary: `匹配度 ${result.matchScore}%，${result.canApply ? '可以投递！' : '还差 ' + result.gapAnalysis.gapCount + ' 个必须技能'}`,
        data: result,
        suggestions: [
          result.canApply ? '可以直接投递，建议先准备面试' : `建议先学习：${result.gapAnalysis.quickWins.join('、')}`,
          '需要生成简历吗？',
          '需要查看岗位详情吗？',
        ],
      };
    } catch (e: any) {
      return this.handleError('check_match', e.message);
    }
  }

  private async executeReviewContent(intent: IntentResult, context?: any): Promise<OrchestrationResult> {
    const { contentType, content, skillName, difficulty } = intent.entities;

    try {
      const result = await this.reviewerAgent.reviewContent(contentType, content, { skillName, difficulty });
      return {
        intent: 'review_content',
        success: true,
        tasks: [{ id: '1', agent: 'ReviewerAgent', action: 'reviewContent', params: intent.entities, priority: 7, status: 'completed', result }],
        summary: `内容审查完成，质量评分 ${result.score}/100`,
        data: result,
        suggestions: ['需要根据审查意见修改内容吗？'],
      };
    } catch (e: any) {
      return this.handleError('review_content', e.message);
    }
  }

  // ── 未知意图处理 ──────────────────────────────────

  private handleUnknownIntent(query: string): OrchestrationResult {
    return {
      intent: 'unknown',
      success: false,
      tasks: [],
      summary: '抱歉，我没有理解你的请求。可以试试以下说法：',
      data: null,
      suggestions: [
        '「帮我生成 React Hooks 讲义」',
        '「分析一下我和前端岗位的差距」',
        '「生成一份简历」',
        '「今天有什么学习任务？」',
        '「帮我准备面试」',
        '输入「帮助」查看更多功能',
      ],
    };
  }

  // ── 错误处理 ──────────────────────────────────

  private handleError(intent: IntentType, message: string): OrchestrationResult {
    return {
      intent,
      success: false,
      tasks: [],
      summary: `执行失败：${message}`,
      data: null,
      suggestions: ['请稍后重试', '如果问题持续，请联系管理员'],
    };
  }

  // ── 工具函数 ──────────────────────────────────

}
