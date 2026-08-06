import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { GeneratedResource } from '../../entities/generated-resource.entity';
import { Resume } from '../../entities/resume.entity';
import { TaskSchedulerService } from '../../services/task-scheduler.service';
import { MatchAgentService } from '../../services/match-agent.service';
import { SkillService } from '../../services/skill.service';
import { EvaluationResult } from '../../entities/evaluation-result.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';

/** 创建 mock Repository */
function mockRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let studentRepo: ReturnType<typeof mockRepo>;
  let learningPathRepo: ReturnType<typeof mockRepo>;
  let taskRepo: ReturnType<typeof mockRepo>;
  let jobRepo: ReturnType<typeof mockRepo>;
  let newsRepo: ReturnType<typeof mockRepo>;
  let examRepo: ReturnType<typeof mockRepo>;
  let jobAppRepo: ReturnType<typeof mockRepo>;
  let resourceRepo: ReturnType<typeof mockRepo>;
  let resumeRepo: ReturnType<typeof mockRepo>;
  let taskScheduler: { getTodayTasks: jest.Mock };
  let matchAgent: { calculateMatch: jest.Mock };
  let evalResultRepo: ReturnType<typeof mockRepo>;
  let skillService: { getEffectiveSkills: jest.Mock };
  let commitRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    studentRepo = mockRepo();
    learningPathRepo = mockRepo();
    taskRepo = mockRepo();
    jobRepo = mockRepo();
    newsRepo = mockRepo();
    examRepo = mockRepo();
    jobAppRepo = mockRepo();
    resourceRepo = mockRepo();
    resumeRepo = mockRepo();
    taskScheduler = { getTodayTasks: jest.fn().mockRejectedValue(new Error('fallback')) };
    matchAgent = { calculateMatch: jest.fn().mockRejectedValue(new Error('fallback')) };
    evalResultRepo = mockRepo();
    skillService = { getEffectiveSkills: jest.fn().mockResolvedValue([]) };
    commitRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: getRepositoryToken(LearningPlan), useValue: learningPathRepo },
        { provide: getRepositoryToken(LearningTask), useValue: taskRepo },
        { provide: getRepositoryToken(JobPosition), useValue: jobRepo },
        { provide: getRepositoryToken(News), useValue: newsRepo },
        { provide: getRepositoryToken(ExamRecord), useValue: examRepo },
        { provide: getRepositoryToken(JobApplication), useValue: jobAppRepo },
        { provide: getRepositoryToken(GeneratedResource), useValue: resourceRepo },
        { provide: getRepositoryToken(Resume), useValue: resumeRepo },
        { provide: getRepositoryToken(EvaluationResult), useValue: evalResultRepo },
        { provide: getRepositoryToken(LearningCommit), useValue: commitRepo },
        { provide: TaskSchedulerService, useValue: taskScheduler },
        { provide: MatchAgentService, useValue: matchAgent },
        { provide: SkillService, useValue: skillService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard - 完整数据场景', () => {
    beforeEach(() => {
      // 学生
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, name: '张三', studentNo: '2023001',
        major: '软件工程', grade: '大三', targetJobId: 5,
        skills: [{ name: 'JavaScript', level: '熟悉' }, { name: 'React', level: '熟悉' }],
        projects: [], onboardingCompleted: 1,
      });

      // 目标岗位
      jobRepo.findOne.mockResolvedValue({
        id: 5, title: '前端开发工程师', company: '腾讯',
        location: '深圳', salaryRange: '15-25K',
        requiredSkills: ['JavaScript', 'React', 'TypeScript'],
        preferredSkills: ['Vue', 'Node.js'],
      });

      // 学习路径
      learningPathRepo.find.mockResolvedValue([{
        id: 1, userId: 100, targetJobId: 5,
        currentPhase: 1, matchScore: 65, estimatedDate: '2026-09', status: 1,
        createTime: new Date('2026-01-01'),
        pathData: {
          phases: [
            {
              name: '基础阶段',
              skills: [
                { name: 'HTML/CSS', status: 'done', duration: '2周' },
                { name: 'JavaScript', status: 'done', duration: '3周' },
              ],
            },
            {
              name: '进阶阶段',
              skills: [
                { name: 'React', status: 'done', duration: '4周' },
                { name: 'TypeScript', status: 'pending', duration: '3周' },
                { name: '状态管理', status: 'pending', duration: '2周' },
              ],
            },
          ],
        },
      }]);

      // 资讯
      newsRepo.find.mockResolvedValue([
        { id: 1, title: '前端趋势', content: '详情', image: '', type: 'tech', source: '掘金', sourceUrl: '', publishTime: 1700000000 },
        { id: 2, title: '校招信息', content: '', image: '', type: 'recruit', source: '牛客', sourceUrl: '', publishTime: 1699000000 },
      ]);

      // 考试 & 投递
      examRepo.count.mockResolvedValue(3);
      jobAppRepo.count.mockResolvedValue(5);
      resourceRepo.count.mockResolvedValue(2);
      resumeRepo.count.mockResolvedValue(1);
      taskRepo.find.mockResolvedValue([
        { id: 1, skillName: 'TypeScript', taskType: 'main', estimatedMin: 90, taskStatus: 'pending', planDate: '2026-01-01' },
        { id: 2, skillName: '状态管理', taskType: 'main', estimatedMin: 60, taskStatus: 'pending', planDate: '2026-01-01' },
      ]);
    });

    it('应返回完整 DashboardData 结构', async () => {
      const result = await service.getDashboard(100);

      expect(result).toHaveProperty('student');
      expect(result).toHaveProperty('target_job');
      expect(result).toHaveProperty('learning_path');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('today_tasks');
      expect(result).toHaveProperty('recent_news');
      expect(result).toHaveProperty('golden_path');
    });

    it('student 应包含正确字段', async () => {
      const result = await service.getDashboard(100);

      expect(result.student).toEqual(expect.objectContaining({
        id: 1, userId: 100, name: '张三', studentNo: '2023001',
        major: '软件工程', grade: '大三', targetJobId: 5,
        skills: [{ name: 'JavaScript', level: '熟悉' }, { name: 'React', level: '熟悉' }],
        projects: [], onboardingCompleted: 1,
      }));
    });

    it('target_job 应包含完整字段和匹配度', async () => {
      const result = await service.getDashboard(100);

      expect(result.target_job).toEqual(expect.objectContaining({
        id: 5, title: '前端开发工程师', company: '腾讯',
        location: '深圳', salaryRange: '15-25K',
        requiredSkills: ['JavaScript', 'React', 'TypeScript'],
        preferredSkills: ['Vue', 'Node.js'],
        matchScore: 67, // 2/3 = 66.67 -> 67
      }));
    });

    it('learning_path 应包含 pathData 和 phases', async () => {
      const result = await service.getDashboard(100);

      expect(result.learning_path).not.toBeNull();
      expect(result.learning_path!.id).toBe(1);
      expect(result.learning_path!.currentPhase).toBe(1);
      expect(result.learning_path!.pathData.phases).toHaveLength(2);
      expect(result.learning_path!.pathData.phases[0].name).toBe('基础阶段');
    });

    it('today_tasks 应只包含当前阶段未完成的技能', async () => {
      const result = await service.getDashboard(100);

      expect(result.today_tasks).toHaveLength(2);
      expect(result.today_tasks[0]).toEqual({
        id: 1, title: 'TypeScript', taskType: 'main', estimatedMin: 90, status: 'pending', planDate: '2026-01-01',
      });
      expect(result.today_tasks[1]).toEqual({
        id: 2, title: '状态管理', taskType: 'main', estimatedMin: 60, status: 'pending', planDate: '2026-01-01',
      });
    });

    it('stats 应包含正确计数', async () => {
      const result = await service.getDashboard(100);

      expect(result.stats).toEqual(expect.objectContaining({
        total_skills: 5,  // 2 + 3
        done_skills: 3,   // 2 + 1
        exam_count: 3,
        job_count: 5,
      }));
    });

    it('recent_news 应包含完整字段', async () => {
      const result = await service.getDashboard(100);

      expect(result.recent_news).toHaveLength(2);
      expect(result.recent_news[0]).toEqual({
        id: 1, title: '前端趋势', content: '详情', image: '',
        type: 'tech', source: '掘金', sourceUrl: '', publishTime: 1700000000,
      });
    });

    it('golden_path 应展示 MVP 九步主路径和下一步', async () => {
      const result = await service.getDashboard(100);

      expect(result.golden_path.steps.map((step: any) => step.key)).toEqual([
        'onboarding',
        'target_job',
        'gap_analysis',
        'learning_plan',
        'generate_resource',
        'assessment',
        'profile_change',
        'match_change',
        'resume_advice',
      ]);
      expect(result.golden_path.completedCount).toBe(9);
      expect(result.golden_path.completionRate).toBe(100);
      expect(result.golden_path.nextAction).toEqual(expect.objectContaining({
        label: '复盘并投递',
        path: '/user/jobs',
      }));
    });
  });

  describe('getDashboard - 无学生记录', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue(null);
      learningPathRepo.find.mockResolvedValue([]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
      resourceRepo.count.mockResolvedValue(0);
      resumeRepo.count.mockResolvedValue(0);
    });

    it('student 应为 null', async () => {
      const result = await service.getDashboard(999);
      expect(result.student).toBeNull();
    });

    it('target_job 应为 null', async () => {
      const result = await service.getDashboard(999);
      expect(result.target_job).toBeNull();
    });

    it('learning_path 应为 null', async () => {
      const result = await service.getDashboard(999);
      expect(result.learning_path).toBeNull();
    });

    it('today_tasks 应为空数组', async () => {
      const result = await service.getDashboard(999);
      expect(result.today_tasks).toEqual([]);
    });

    it('stats 应全为 0', async () => {
      const result = await service.getDashboard(999);
      expect(result.stats).toEqual(expect.objectContaining({
        total_skills: 0, done_skills: 0, exam_count: 0, job_count: 0,
      }));
    });

    it('golden_path 应从 Onboarding 开始引导', async () => {
      const result = await service.getDashboard(999);
      expect(result.golden_path.currentKey).toBe('onboarding');
      expect(result.golden_path.nextAction.path).toBe('/onboarding');
    });
  });

  describe('getDashboard - 无目标岗位', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, name: '李四', studentNo: '2023002',
        major: '计算机', grade: '大二', targetJobId: null,
        skills: [], projects: [], onboardingCompleted: 1,
      });
      jobRepo.findOne.mockResolvedValue(null);
      learningPathRepo.find.mockResolvedValue([]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
      resourceRepo.count.mockResolvedValue(0);
      resumeRepo.count.mockResolvedValue(0);
    });

    it('target_job 应为 null', async () => {
      const result = await service.getDashboard(100);
      expect(result.target_job).toBeNull();
      expect(jobRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getDashboard - 所有技能已完成', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, name: '王五', studentNo: '2023003',
        major: '软件工程', grade: '大四', targetJobId: 1,
        skills: [{ name: 'React', level: '精通' }],
        projects: [], onboardingCompleted: 1,
      });
      jobRepo.findOne.mockResolvedValue({
        id: 1, title: '全栈工程师', company: '阿里',
        location: '杭州', salaryRange: '20-35K',
        requiredSkills: ['React', 'Node.js'],
        preferredSkills: [],
      });
      learningPathRepo.find.mockResolvedValue([{
        id: 2, userId: 100, targetJobId: 1,
        currentPhase: 0, matchScore: 50, estimatedDate: '2026-12', status: 1,
        createTime: new Date(),
        pathData: {
          phases: [{
            name: '全部完成',
            skills: [
              { name: 'React', status: 'done', duration: '4周' },
              { name: 'Node.js', status: 'done', duration: '3周' },
            ],
          }],
        },
      }]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
      resourceRepo.count.mockResolvedValue(0);
      resumeRepo.count.mockResolvedValue(0);
    });

    it('today_tasks 应为空（全部完成）', async () => {
      const result = await service.getDashboard(100);
      expect(result.today_tasks).toEqual([]);
    });

    it('matchScore 应基于学生技能计算', async () => {
      const result = await service.getDashboard(100);
      expect(result.target_job!.matchScore).toBe(50); // 1/2 = 50%
    });
  });

  describe('getDashboard - today_tasks 上限', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, name: '测试', studentNo: '001',
        major: 'CS', grade: '大一', targetJobId: null,
        skills: [], projects: [], onboardingCompleted: 1,
      });
      // 8 个未完成技能，应只返回 6 个
      const skills = Array.from({ length: 8 }, (_, i) => ({
        name: `skill-${i}`, status: 'pending', duration: '1周',
      }));
      taskRepo.find.mockResolvedValue(Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        skillName: `skill-${i}`,
        taskType: 'main',
        estimatedMin: 30,
        taskStatus: 'pending',
        planDate: '2026-01-01',
      })));
      learningPathRepo.find.mockResolvedValue([{
        id: 1, userId: 100, targetJobId: null,
        currentPhase: 0, matchScore: 0, estimatedDate: '', status: 1,
        createTime: new Date(),
        pathData: { phases: [{ name: '测试阶段', skills }] },
      }]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
      resourceRepo.count.mockResolvedValue(0);
      resumeRepo.count.mockResolvedValue(0);
    });

    it('today_tasks 返回任务表中的待办', async () => {
      const result = await service.getDashboard(100);
      expect(result.today_tasks).toHaveLength(8);
    });
  });

  describe('getTodayActions - 无目标岗位兜底', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, targetJobId: null, skills: [],
      });
    });

    it('主任务引导选择目标岗位，无辅助任务', async () => {
      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('onboarding');
      expect(result.main.title).toContain('选择目标岗位');
      expect(result.main.path).toBe('/user/jobs');
      expect(result.main.reason).toBeTruthy();
      expect(result.subs).toEqual([]);
      expect(jobRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getTodayActions - 有目标岗位', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({
        id: 1, userId: 100, targetJobId: 5, skills: [],
      });
      jobRepo.findOne.mockResolvedValue({
        id: 5, title: '前端开发实习生',
        requiredSkills: [
          { name: 'React Hooks', weight: 1, minLevel: 70 },
          { name: '接口联调', weight: 1, minLevel: 60 },
        ],
        preferredSkills: [{ name: 'TypeScript', weight: 0.5, minLevel: 50 }],
      });
    });

    it('主任务来自岗位必备缺口，含原因与预计影响', async () => {
      skillService.getEffectiveSkills.mockResolvedValue([
        { name: 'React', masteryPct: 20 },
      ]);

      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('learning');
      expect(result.main.title).toContain('React Hooks');
      expect(result.main.reason).toContain('React Hooks');
      expect(result.main.reason).toContain('70%');
      expect(result.main.estimatedImpact).toBeGreaterThan(0);
      expect(result.main.impactLabel).toContain('+');
      expect(result.main.path).toBe('/user/learning');
      expect(result.main.evidence).toContain('commit');
    });

    it('辅助任务包含未完成排期任务和测评薄弱点', async () => {
      skillService.getEffectiveSkills.mockResolvedValue([]);
      taskScheduler.getTodayTasks.mockResolvedValue({
        mainTasks: [
          { id: 11, skillName: '接口联调', taskType: 'main', taskStatus: 'pending', estimatedMin: 40 },
        ],
        sideTasks: [],
      });
      evalResultRepo.find.mockResolvedValue([
        { id: 1, skillName: 'React Hooks', passed: 0, normalizedScore: 45 },
      ]);

      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('learning');
      // 主任务之外最多 2 个辅助任务：continue + quick-test
      expect(result.subs).toHaveLength(2);
      expect(result.subs[0].taskType).toBe('continue');
      expect(result.subs[0].id).toBe(11);
      expect(result.subs[0].reason).toContain('未完成');
      expect(result.subs[1].taskType).toBe('quick-test');
      expect(result.subs[1].title).toContain('React Hooks');
      expect(result.subs[1].reason).toContain('45');
    });

    it('辅助任务去重：薄弱点与未完成任务相同时不重复推荐', async () => {
      skillService.getEffectiveSkills.mockResolvedValue([]);
      taskScheduler.getTodayTasks.mockResolvedValue({
        mainTasks: [
          { id: 12, skillName: 'React Hooks', taskType: 'main', taskStatus: 'pending', estimatedMin: 30 },
        ],
        sideTasks: [],
      });
      evalResultRepo.find.mockResolvedValue([
        { id: 1, skillName: 'React Hooks', passed: 0, normalizedScore: 40 },
      ]);

      const result = await service.getTodayActions(100);

      // continue 任务标题包含 React Hooks，quick-test 被去重
      expect(result.subs).toHaveLength(1);
      expect(result.subs[0].taskType).toBe('continue');
    });

    it('必备技能已覆盖时主任务转为项目证据任务', async () => {
      skillService.getEffectiveSkills.mockResolvedValue([
        { name: 'React Hooks', masteryPct: 80 },
        { name: '接口联调', masteryPct: 70 },
      ]);

      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('project');
      expect(result.main.title).toContain('TypeScript');
      expect(result.main.estimatedImpact).toBe(4);
      expect(result.main.path).toBe('/user/projects');
    });

    it('全部覆盖时主任务为复习速测', async () => {
      skillService.getEffectiveSkills.mockResolvedValue([
        { name: 'React Hooks', masteryPct: 80 },
        { name: '接口联调', masteryPct: 70 },
        { name: 'TypeScript', masteryPct: 60 },
      ]);

      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('review');
      expect(result.main.path).toBe('/user/quick-test');
    });

    it('目标岗位下架时引导重新选择', async () => {
      jobRepo.findOne.mockResolvedValue(null);

      const result = await service.getTodayActions(100);

      expect(result.main.taskType).toBe('onboarding');
      expect(result.main.title).toContain('重新选择');
    });
  });

  describe('getGrowthReport - 阶段成长报告（P2-2）', () => {
    const now = Date.now();
    const recent = now - 3 * 86400000; // 3 天前（30 天窗口内）
    const old = now - 45 * 86400000;   // 45 天前（窗口外）

    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue({ id: 1, userId: 100, targetJobId: 5, status: 1 });
      jobRepo.findOne.mockResolvedValue({ id: 5, title: '前端开发实习生', status: 1 });
      commitRepo.find.mockResolvedValue([
        {
          id: 1, commitType: 'lecture_read', skillName: 'React', message: 'lecture read: React',
          deltaJson: {
            skillChanges: [{ name: 'React', before: 20, after: 35, delta: 15 }],
            metricsChange: { matchScore: 5 },
          },
          createTime: recent, status: 1,
        },
        {
          id: 2, commitType: 'quiz_passed', skillName: '接口联调', message: 'quiz passed: 接口联调',
          deltaJson: {
            skillChanges: [{ name: '接口联调', before: 10, after: 30, delta: 20 }],
            metricsChange: { matchScore: 3 },
          },
          createTime: recent, status: 1,
        },
        {
          id: 3, commitType: 'baseline', skillName: null, message: 'baseline',
          deltaJson: null, createTime: old, status: 1,
        },
      ]);
      taskRepo.find.mockResolvedValue([
        { id: 1, userId: 100, planDate: new Date(recent).toISOString().slice(0, 10), taskStatus: 'done', actualMin: 40, isActive: 1 },
        { id: 2, userId: 100, planDate: new Date(recent).toISOString().slice(0, 10), taskStatus: 'pending', isActive: 1 },
        { id: 3, userId: 100, planDate: new Date(old).toISOString().slice(0, 10), taskStatus: 'done', actualMin: 30, isActive: 1 },
      ]);
      evalResultRepo.find.mockResolvedValue([
        { id: 1, skillName: 'React', normalizedScore: 80, passed: 1, createTime: recent, status: 1 },
        { id: 2, skillName: '接口联调', normalizedScore: 45, passed: 0, createTime: recent, status: 1 },
        { id: 3, skillName: '旧技能', normalizedScore: 90, passed: 1, createTime: old, status: 1 },
      ]);
      matchAgent.calculateMatch.mockRejectedValue(new Error('fallback'));
    });

    it('聚合 30 天学习/技能/测评/匹配数据并生成建议', async () => {
      // 当前最佳匹配
      const getBestMatch = jest.fn().mockResolvedValue({ jobId: 5, jobTitle: '前端开发实习生', matchScore: 63, canApply: false });
      (matchAgent as any).getBestMatch = getBestMatch;

      const result = await service.getGrowthReport(100, 30);

      expect(result.days).toBe(30);
      // 任务：窗口内 2 个（1 done 1 pending）
      expect(result.summary.tasksDone).toBe(1);
      expect(result.summary.totalTasks).toBe(2);
      expect(result.summary.taskRate).toBe(50);
      expect(result.summary.learnedMin).toBe(40);
      // 测评：窗口内 2 次，1 达标
      expect(result.summary.examCount).toBe(2);
      expect(result.summary.examPassRate).toBe(50);
      expect(result.summary.avgExamScore).toBe(62.5);
      // 匹配变化：窗口内 delta 5+3=8，当前 63 → 前值 55
      expect(result.summary.matchDelta).toBe(8);
      expect(result.summary.matchNow).toBe(63);
      expect(result.summary.matchBefore).toBe(55);
      expect(result.summary.jobTitle).toBe('前端开发实习生');
      // 技能变化（窗口内非 baseline 聚合）
      expect(result.skillChanges).toEqual(expect.arrayContaining([
        expect.objectContaining({ skill: '接口联调', from: 10, to: 30, delta: 20 }),
        expect.objectContaining({ skill: 'React', from: 20, to: 35, delta: 15 }),
      ]));
      // baseline 不进时间线
      expect(result.commitTimeline).toHaveLength(2);
      // 建议：技能提升 + 测评达标率低
      expect(result.recommendations.some((r: string) => r.includes('React'))).toBe(true);
      expect(result.recommendations.some((r: string) => r.includes('测评达标率偏低'))).toBe(true);
    });

    it('days=7 时窗口收缩为 7 天', async () => {
      const getBestMatch = jest.fn().mockResolvedValue(null);
      (matchAgent as any).getBestMatch = getBestMatch;

      const result = await service.getGrowthReport(100, 7);

      expect(result.days).toBe(7);
      // 3 天前的 commit 仍在 7 天窗口内
      expect(result.summary.commits).toBe(2);
    });

    it('无数据时给出引导建议', async () => {
      commitRepo.find.mockResolvedValue([]);
      taskRepo.find.mockResolvedValue([]);
      evalResultRepo.find.mockResolvedValue([]);
      const getBestMatch = jest.fn().mockResolvedValue(null);
      (matchAgent as any).getBestMatch = getBestMatch;

      const result = await service.getGrowthReport(100, 30);

      expect(result.summary.commits).toBe(0);
      expect(result.skillChanges).toEqual([]);
      expect(result.examTrend).toEqual([]);
      expect(result.recommendations[0]).toContain('没有学习记录');
    });
  });
});
