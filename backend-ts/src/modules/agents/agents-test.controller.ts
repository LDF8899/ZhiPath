import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
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
  OrchestratorAgentService,
  VideoAgentService,
  TokenTrackerService,
} from '../../services/agents';
import { success, error } from '../../common/api-response';

/**
 * 智能体测试控制器
 *
 * 用于测试所有智能体的生成质量
 * 访问：POST /api/test/agents/{agentName}
 */

@Controller('test/agents')
export class AgentsTestController {
  constructor(
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
    private orchestratorAgent: OrchestratorAgentService,
    private videoAgent: VideoAgentService,
    private tokenTracker: TokenTrackerService,
  ) {}

  // ── 1. 讲义生成 ──────────────────────────────────

  @Post('lecture')
  async testLecture(@Body() body: { skillName?: string; level?: string }) {
    const skillName = body.skillName || 'React Hooks';
    const level = (body.level as any) || 'beginner';
    const start = Date.now();

    try {
      const result = await this.lectureAgent.generate(skillName, level);
      return success({
        agent: 'LectureAgent',
        input: { skillName, level },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          wordCount: result.wordCount,
          exerciseCount: result.exercises.length,
          keyPointCount: result.keyPoints.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 2. 拓展阅读 ──────────────────────────────────

  @Post('reading')
  async testReading(@Body() body: { skillName?: string; count?: number }) {
    const skillName = body.skillName || 'React Hooks';
    const count = body.count || 3;
    const start = Date.now();

    try {
      const result = await this.readingAgent.generate(skillName, count);
      return success({
        agent: 'ReadingAgent',
        input: { skillName, count },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          itemCount: result.totalItems,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 3. 代码案例 ──────────────────────────────────

  @Post('code')
  async testCode(@Body() body: { skillName?: string; language?: string; count?: number }) {
    const skillName = body.skillName || 'React Hooks';
    const language = body.language || 'JavaScript';
    const count = body.count || 2;
    const start = Date.now();

    try {
      const result = await this.codeAgent.generate(skillName, language, count);
      return success({
        agent: 'CodeAgent',
        input: { skillName, language, count },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          exampleCount: result.totalExamples,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 4. 学习路径 ──────────────────────────────────

  @Post('path')
  async testPath(@Body() body: { goal?: string; currentLevel?: string }) {
    const goal = body.goal || '前端开发工程师';
    const currentLevel = body.currentLevel || '零基础';
    const start = Date.now();

    try {
      const result = await this.pathAgent.generate(goal, currentLevel);
      return success({
        agent: 'PathAgent',
        input: { goal, currentLevel },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          stageCount: result.stages.length,
          totalDuration: result.totalDuration,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 5. 学习评估 ──────────────────────────────────

  @Post('assess')
  async testAssess(@Body() body: { learningData?: string; goal?: string }) {
    const learningData = body.learningData || '学了2周React Hooks，完成了useState和useEffect讲义，做了20道选择题正确率80%，写了2个小项目';
    const goal = body.goal || '掌握 React Hooks';
    const start = Date.now();

    try {
      const result = await this.assessAgent.assess(learningData, goal);
      return success({
        agent: 'AssessAgent',
        input: { learningData, goal },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          overallScore: result.overallScore,
          dimensionCount: result.dimensions.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 6. JD 解析 ──────────────────────────────────

  @Post('jd-parser')
  async testJDParser(@Body() body: { jdText?: string }) {
    const jdText = body.jdText || `前端开发工程师
职位描述：
1. 负责公司产品的前端开发工作
2. 参与产品需求评审和技术方案设计
3. 优化前端性能，提升用户体验

任职要求：
1. 本科及以上学历，计算机相关专业
2. 熟练掌握 React、Vue 等前端框架
3. 熟悉 TypeScript、Webpack、Vite 等工具
4. 了解 Node.js，有全栈开发经验优先
5. 良好的沟通能力和团队协作精神

加分项：
1. 有大型项目开发经验
2. 熟悉 Docker、CI/CD
3. 有开源项目贡献经历`;
    const start = Date.now();

    try {
      const result = await this.jdParserAgent.parse(jdText);
      return success({
        agent: 'JDParserAgent',
        input: { jdText: jdText.substring(0, 200) + '...' },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          requiredSkillCount: result.requiredSkills.length,
          preferredSkillCount: result.preferredSkills.length,
          confidence: result.confidence,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 7. 质量审查 ──────────────────────────────────

  @Post('reviewer')
  async testReviewer(@Body() body: { contentType?: string; content?: string }) {
    const contentType = (body.contentType as any) || 'quiz';
    const content = body.content || JSON.stringify({
      questions: [
        {
          type: 'choice',
          question: '以下关于 React useState 的说法，正确的是？',
          options: ['A. useState 只能在类组件中使用', 'B. useState 返回一个数组，包含状态值和更新函数', 'C. useState 的更新是同步的', 'D. useState 不能在循环中调用'],
          answer: 'B',
          explanation: 'useState 是 React Hooks，只能在函数组件中使用，返回 [state, setState] 数组。'
        }
      ]
    });
    const start = Date.now();

    try {
      const result = await this.reviewerAgent.reviewContent(contentType, content, { skillName: 'React Hooks' });
      return success({
        agent: 'ReviewerAgent',
        input: { contentType, contentPreview: content.substring(0, 200) },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          passed: result.passed,
          score: result.score,
          issueCount: result.issues.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 8. 简历生成 ──────────────────────────────────

  @Post('resume')
  async testResume(@Body() body: { profile?: any; targetJob?: any }) {
    const profile = body.profile || {
      basicInfo: {
        name: '张三',
        school: '北京大学',
        major: '计算机科学与技术',
        grade: '大四',
        email: 'zhangsan@example.com',
        github: 'github.com/zhangsan',
      },
      skills: [
        { name: 'React', mastery: 85, verified: true },
        { name: 'JavaScript', mastery: 90, verified: true },
        { name: 'TypeScript', mastery: 70, verified: false },
        { name: 'CSS', mastery: 80, verified: false },
        { name: 'Node.js', mastery: 60, verified: false },
      ],
      projects: [
        {
          name: '在线教育平台',
          description: '使用 React + TypeScript 开发的在线教育平台，支持视频播放、在线编程、作业提交等功能',
          techStack: ['React', 'TypeScript', 'Ant Design', 'Node.js', 'MongoDB'],
          role: '前端负责人',
        },
      ],
      exams: [
        { skill: 'React', score: 92, passedAt: '2026-06-01' },
        { skill: 'JavaScript', score: 88, passedAt: '2026-05-15' },
      ],
      learningPaths: [
        { name: '前端开发工程师', progress: 75 },
      ],
    };

    const targetJob = body.targetJob || {
      title: '前端开发工程师',
      company: '字节跳动',
      requiredSkills: ['React', 'JavaScript', 'TypeScript', 'CSS', 'HTML'],
      preferredSkills: ['Node.js', 'Vue', 'Webpack'],
      level: 'junior',
    };
    const start = Date.now();

    try {
      const result = await this.resumeAgent.generate(profile, targetJob);
      return success({
        agent: 'ResumeAgent',
        input: { profileName: profile.basicInfo.name, targetJob: targetJob.title },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          sectionCount: result.sections.length,
          highlightCount: result.highlights.length,
          htmlLength: result.html.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 9. 用户画像分析 ──────────────────────────────────

  @Post('profile')
  async testProfile(@Body() body: { learningData?: any }) {
    const learningData = body.learningData || {
      userId: 123,
      period: 'week',
      totalMinutes: 480,
      daysActive: 5,
      skillsLearned: [
        { name: 'React Hooks', minutesSpent: 180, masteryBefore: 30, masteryAfter: 85, tasksCompleted: 4 },
        { name: 'CSS Grid', minutesSpent: 120, masteryBefore: 0, masteryAfter: 60, tasksCompleted: 2 },
      ],
      examsTaken: [
        { skill: 'React Hooks', score: 88, passed: true },
      ],
      matchScoreBefore: 62,
      matchScoreAfter: 68,
      streakDays: 5,
      dailyAverage: 96,
    };
    const start = Date.now();

    try {
      const result = await this.profileAgent.generateReport(learningData);
      return success({
        agent: 'ProfileAgent',
        input: { period: learningData.period, skillCount: learningData.skillsLearned.length },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          achievementCount: result.achievements.length,
          recommendationCount: result.recommendations.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 10. 考试出题 ──────────────────────────────────

  @Post('exam')
  async testExam(@Body() body: { skillName?: string; difficulty?: string; questionCount?: number }) {
    const skillName = body.skillName || 'React Hooks';
    const difficulty = (body.difficulty as any) || 'mixed';
    const questionCount = body.questionCount || 5;
    const start = Date.now();

    try {
      const result = await this.examAgent.generateExam({
        skillName,
        difficulty,
        questionCount,
        questionTypes: ['choice', 'fill'],
      });
      return success({
        agent: 'ExamAgent',
        input: { skillName, difficulty, questionCount },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          totalQuestions: result.totalQuestions,
          totalTimeLimit: result.totalTimeLimit,
          knowledgePointCount: result.metadata.knowledgePoints.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 11. 技能差距分析 ──────────────────────────────────

  @Post('skill-gap')
  async testSkillGap(@Body() body: { userSkills?: any[]; targetJob?: any }) {
    const userSkills = body.userSkills || [
      { name: 'React', mastery: 85, verified: true },
      { name: 'JavaScript', mastery: 90, verified: true },
      { name: 'TypeScript', mastery: 40, verified: false },
      { name: 'CSS', mastery: 80, verified: false },
    ];

    const targetJob = body.targetJob || {
      title: '前端开发工程师',
      company: '字节跳动',
      level: 'junior',
      requiredSkills: [
        { name: 'React', weight: 0.9, minLevel: 70 },
        { name: 'JavaScript', weight: 0.9, minLevel: 80 },
        { name: 'TypeScript', weight: 0.8, minLevel: 60 },
        { name: 'CSS', weight: 0.7, minLevel: 70 },
        { name: 'HTML', weight: 0.6, minLevel: 60 },
      ],
      preferredSkills: [
        { name: 'Node.js', weight: 0.4, minLevel: 50 },
        { name: 'Vue', weight: 0.3, minLevel: 50 },
      ],
    };
    const start = Date.now();

    try {
      const result = await this.skillGapAgent.analyze({ userSkills, targetJob });
      return success({
        agent: 'SkillGapAgent',
        input: { skillCount: userSkills.length, jobTitle: targetJob.title },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          matchScore: result.matchScore,
          gapCount: result.gapSkills.length,
          canApply: result.canApply,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 12. 每日任务 ──────────────────────────────────

  @Post('daily-task')
  async testDailyTask(@Body() body: { availableMinutes?: number }) {
    const input = {
      userId: 123,
      date: new Date().toISOString().split('T')[0],
      availableMinutes: body.availableMinutes || 120,
      mainlineRatio: 0.8,
      currentPath: {
        planId: 'plan_1',
        planName: '前端开发工程师',
        currentPhase: 0,
        phases: [
          {
            name: 'HTML/CSS/JavaScript 基础',
            skills: [
              { id: 'html', name: 'HTML5', status: 'done' as const, mastery: 90, estimatedMinutes: 60, dependencies: [] },
              { id: 'css', name: 'CSS3', status: 'in_progress' as const, mastery: 40, estimatedMinutes: 90, dependencies: ['html'] },
              { id: 'js', name: 'JavaScript', status: 'pending' as const, mastery: 0, estimatedMinutes: 120, dependencies: ['html'] },
            ],
          },
        ],
      },
      recentHistory: {
        consecutiveDays: 3,
        averageMinutes: 90,
        lastSessionDate: new Date().toISOString().split('T')[0],
        pace: 'normal' as const,
      },
    };
    const start = Date.now();

    try {
      const result = await this.dailyTaskAgent.generateTasks(input);
      return success({
        agent: 'DailyTaskAgent',
        input: { availableMinutes: input.availableMinutes },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          mainlineCount: result.mainlineTasks.length,
          sideCount: result.sideTasks.length,
          totalMinutes: result.totalEstimatedMinutes,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 13. 资讯生成 ──────────────────────────────────

  @Post('news')
  async testNews(@Body() body: { skills?: string[] }) {
    const skills = body.skills || ['React', 'Vue', 'TypeScript'];
    const start = Date.now();

    try {
      const result = await this.newsAgent.generateTrendAnalysis(skills);
      return success({
        agent: 'NewsAgent',
        input: { skills },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          trendCount: result.trends.length,
          hotSkillCount: result.hotSkills.length,
          predictionCount: result.predictions.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 14. 中控智能体 ──────────────────────────────────

  @Post('orchestrator')
  async testOrchestrator(@Body() body: { query?: string }) {
    const query = body.query || '帮我生成 React Hooks 讲义';
    const start = Date.now();

    try {
      const result = await this.orchestratorAgent.handleRequest(query);
      return success({
        agent: 'OrchestratorAgent',
        input: { query },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          intent: result.intent,
          success: result.success,
          taskCount: result.tasks.length,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 15. 视频生成 ──────────────────────────────────

  @Post('video')
  async testVideo(@Body() body: { skillName?: string; difficulty?: string }) {
    const skillName = body.skillName || 'React Hooks useEffect';
    const difficulty = (body.difficulty as any) || 'beginner';
    const start = Date.now();

    try {
      const result = await this.videoAgent.generate({
        task_id: `test_${Date.now()}`,
        skill_name: skillName,
        knowledge_content: `# ${skillName}\n\nuseEffect 是 React 中用于处理副作用的 Hook。它接收两个参数：副作用函数和依赖数组。`,
        difficulty,
      });

      return success({
        agent: 'VideoAgent',
        input: { skillName, difficulty },
        output: result,
        stats: {
          timeMs: Date.now() - start,
          status: result.status,
          segmentsCount: result.result?.segments_count,
          durationSec: result.result?.duration_sec,
          costEstimate: result.result?.cost_estimate,
        },
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }

  // ── 全量测试 ──────────────────────────────────

  @Post('all')
  async testAll() {
    const results: any[] = [];
    const startTime = Date.now();

    // 测试用例
    const testCases = [
      { name: 'LectureAgent', fn: () => this.testLecture({}) },
      { name: 'ReadingAgent', fn: () => this.testReading({}) },
      { name: 'CodeAgent', fn: () => this.testCode({}) },
      { name: 'PathAgent', fn: () => this.testPath({}) },
      { name: 'AssessAgent', fn: () => this.testAssess({}) },
      { name: 'JDParserAgent', fn: () => this.testJDParser({}) },
      { name: 'ReviewerAgent', fn: () => this.testReviewer({}) },
      { name: 'ExamAgent', fn: () => this.testExam({}) },
      { name: 'SkillGapAgent', fn: () => this.testSkillGap({}) },
      { name: 'DailyTaskAgent', fn: () => this.testDailyTask({}) },
      { name: 'NewsAgent', fn: () => this.testNews({}) },
      { name: 'OrchestratorAgent', fn: () => this.testOrchestrator({}) },
    ];

    // 串行执行（避免并发压力）
    for (const tc of testCases) {
      const start = Date.now();
      try {
        const result = await tc.fn();
        results.push({
          agent: tc.name,
          success: true,
          timeMs: Date.now() - start,
          stats: (result as any)?.data?.stats,
        });
      } catch (e: any) {
        results.push({
          agent: tc.name,
          success: false,
          timeMs: Date.now() - start,
          error: e.message,
        });
      }
    }

    return success({
      totalTimeMs: Date.now() - startTime,
      results,
      summary: {
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  }

  // ── Token 用量查询 ──────────────────────────────────

  @Get('token-stats')
  async getTokenStats(@Query('agent') agent?: string, @Query('period') period?: string) {
    try {
      let stats;
      if (period === 'today') {
        stats = this.tokenTracker.getTodayStats();
      } else if (period === 'month') {
        stats = this.tokenTracker.getMonthStats();
      } else {
        stats = this.tokenTracker.getStats({ agent });
      }

      return success({
        ...stats,
        budgetStatus: this.tokenTracker.getBudgetStatus(),
      });
    } catch (e: any) {
      return error(500, e.message);
    }
  }
}
