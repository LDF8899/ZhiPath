import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';

/** 创建 mock Repository */
function mockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let studentRepo: ReturnType<typeof mockRepo>;
  let learningPathRepo: ReturnType<typeof mockRepo>;
  let jobRepo: ReturnType<typeof mockRepo>;
  let newsRepo: ReturnType<typeof mockRepo>;
  let examRepo: ReturnType<typeof mockRepo>;
  let jobAppRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    studentRepo = mockRepo();
    learningPathRepo = mockRepo();
    jobRepo = mockRepo();
    newsRepo = mockRepo();
    examRepo = mockRepo();
    jobAppRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: getRepositoryToken(LearningPlan), useValue: learningPathRepo },
        { provide: getRepositoryToken(JobPosition), useValue: jobRepo },
        { provide: getRepositoryToken(News), useValue: newsRepo },
        { provide: getRepositoryToken(ExamRecord), useValue: examRepo },
        { provide: getRepositoryToken(JobApplication), useValue: jobAppRepo },
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
    });

    it('应返回完整 DashboardData 结构', async () => {
      const result = await service.getDashboard(100);

      expect(result).toHaveProperty('student');
      expect(result).toHaveProperty('target_job');
      expect(result).toHaveProperty('learning_path');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('today_tasks');
      expect(result).toHaveProperty('recent_news');
    });

    it('student 应包含正确字段', async () => {
      const result = await service.getDashboard(100);

      expect(result.student).toEqual({
        id: 1, userId: 100, name: '张三', studentNo: '2023001',
        major: '软件工程', grade: '大三', targetJobId: 5,
        skills: [{ name: 'JavaScript', level: '熟悉' }, { name: 'React', level: '熟悉' }],
        projects: [], onboardingCompleted: 1,
      });
    });

    it('target_job 应包含完整字段和匹配度', async () => {
      const result = await service.getDashboard(100);

      expect(result.target_job).toEqual({
        id: 5, title: '前端开发工程师', company: '腾讯',
        location: '深圳', salaryRange: '15-25K',
        requiredSkills: ['JavaScript', 'React', 'TypeScript'],
        preferredSkills: ['Vue', 'Node.js'],
        matchScore: 67, // 2/3 = 66.67 -> 67
      });
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
        title: 'TypeScript', phase: '进阶阶段', duration: '3周', status: 'pending',
      });
      expect(result.today_tasks[1]).toEqual({
        title: '状态管理', phase: '进阶阶段', duration: '2周', status: 'pending',
      });
    });

    it('stats 应包含正确计数', async () => {
      const result = await service.getDashboard(100);

      expect(result.stats).toEqual({
        total_skills: 5,  // 2 + 3
        done_skills: 3,   // 2 + 1
        exam_count: 3,
        job_count: 5,
      });
    });

    it('recent_news 应包含完整字段', async () => {
      const result = await service.getDashboard(100);

      expect(result.recent_news).toHaveLength(2);
      expect(result.recent_news[0]).toEqual({
        id: 1, title: '前端趋势', content: '详情', image: '',
        type: 'tech', source: '掘金', sourceUrl: '', publishTime: 1700000000,
      });
    });
  });

  describe('getDashboard - 无学生记录', () => {
    beforeEach(() => {
      studentRepo.findOne.mockResolvedValue(null);
      learningPathRepo.find.mockResolvedValue([]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
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
      expect(result.stats).toEqual({
        total_skills: 0, done_skills: 0, exam_count: 0, job_count: 0,
      });
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
      learningPathRepo.find.mockResolvedValue([{
        id: 1, userId: 100, targetJobId: null,
        currentPhase: 0, matchScore: 0, estimatedDate: '', status: 1,
        createTime: new Date(),
        pathData: { phases: [{ name: '测试阶段', skills }] },
      }]);
      newsRepo.find.mockResolvedValue([]);
      examRepo.count.mockResolvedValue(0);
      jobAppRepo.count.mockResolvedValue(0);
    });

    it('today_tasks 最多返回 6 条', async () => {
      const result = await service.getDashboard(100);
      expect(result.today_tasks).toHaveLength(6);
    });
  });
});
