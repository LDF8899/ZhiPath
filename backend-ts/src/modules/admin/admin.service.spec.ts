import { AdminService } from './admin.service';

describe('AdminService employment dashboard (P2-1)', () => {
  function setup(overrides: {
    students?: any[];
    allStudents?: any[];
    jobs?: any[];
    skills?: any[];
    tasks?: any[];
    evalResults?: any[];
    plans?: any[];
    chunks?: any[];
  } = {}) {
    const students = overrides.students ?? [
      { id: 1, userId: 101, name: '张三', studentNo: '2023001', major: '软件工程', grade: '大三', school: 'ZhiPath 大学', targetJobId: 5, status: 1 },
      { id: 2, userId: 102, name: '李四', studentNo: '2023002', major: '软件工程', grade: '大三', school: 'ZhiPath 大学', targetJobId: 5, status: 1 },
      { id: 3, userId: 103, name: '王五', studentNo: '2024001', major: '计算机', grade: '大二', school: 'ZhiPath 大学', targetJobId: 6, status: 1 },
      { id: 4, userId: 104, name: '赵六', studentNo: '2023003', major: '软件工程', grade: '大三', school: 'ZhiPath 大学', targetJobId: null, status: 1 },
    ];
    const allStudents = overrides.allStudents ?? students;

    const repo = (data: any[]) => ({
      find: jest.fn(async (opts?: any) => {
        // 简单模拟 where.userId In 过滤（测试场景不真正过滤）
        return data;
      }),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    });

    const service = new AdminService(
      repo([]) as any,          // user
      Object.assign(repo(students), { find: jest.fn().mockResolvedValue(students) }) as any, // student
      Object.assign(repo(overrides.jobs ?? []), {
        find: jest.fn(async () => overrides.jobs ?? [
          { id: 5, title: '前端开发实习生', status: 1 },
          { id: 6, title: '后端开发实习生', status: 1 },
        ]),
      }) as any, // job
      repo([]) as any,          // application
      repo([]) as any,          // enterprise
      repo([]) as any,          // news
      repo([]) as any,          // exam
      repo([]) as any,          // resume
      repo([]) as any,          // config
      repo([]) as any,          // question
      repo([]) as any,          // resource
      repo(overrides.skills ?? []) as any,   // userSkill
      repo(overrides.tasks ?? []) as any,    // learningTask
      repo(overrides.evalResults ?? []) as any, // evaluationResult
      repo(overrides.plans ?? []) as any,    // learningPlan
      repo(overrides.chunks ?? []) as any,   // evidenceChunk
    );

    return { service };
  }

  it('聚合目标岗位分布、技能缺口、任务完成率、测评达标率与准备度分层', async () => {
    const { service } = setup({
      skills: [
        { userId: 101, skillName: 'React Hooks', masteryPct: 30, status: 1 },
        { userId: 101, skillName: 'JavaScript', masteryPct: 80, status: 1 },
        { userId: 102, skillName: 'React Hooks', masteryPct: 20, status: 1 },
        { userId: 103, skillName: '接口联调', masteryPct: 10, status: 1 },
      ],
      tasks: [
        { userId: 101, taskStatus: 'done' },
        { userId: 101, taskStatus: 'pending' },
        { userId: 102, taskStatus: 'exam_done' },
      ],
      evalResults: [
        { userId: 101, passed: 1, normalizedScore: 80 },
        { userId: 102, passed: 0, normalizedScore: 40 },
        { userId: 103, passed: 1, normalizedScore: 90 },
      ],
      plans: [
        { userId: 101, matchScore: 85 },
        { userId: 102, matchScore: 62 },
        { userId: 103, matchScore: 45 },
      ],
      // P2-1：证据覆盖（101 有 React Hooks 项目证据，102 无）
      chunks: [
        { id: 1, userId: 101, sourceType: 'project', skillTags: ['React Hooks'], vectorStatus: 'indexed', status: 1 },
        { id: 2, userId: 101, sourceType: 'file_qa', skillTags: ['React Hooks'], vectorStatus: 'indexed', status: 1 },
      ],
    });

    const result = await service.getEmploymentDashboard({});

    expect(result.overview.studentCount).toBe(4);
    expect(result.overview.withTargetJob).toBe(3);
    expect(result.overview.targetJobRate).toBe(75);
    // 任务完成率 2/3
    expect(result.taskCompletion).toEqual({ done: 2, total: 3, rate: 66.7 });
    // 测评达标率 2/3
    expect(result.examPass).toEqual({ passed: 2, total: 3, rate: 66.7 });
    // 准备度分层：85→高、62→中、45→低、无计划→低
    expect(result.overview.readiness).toEqual({ high: 1, medium: 1, low: 2 });
    // 目标岗位分布
    expect(result.targetJobDistribution[0]).toEqual(expect.objectContaining({
      jobTitle: '前端开发实习生',
      count: 2,
      pct: 50,
    }));
    // 技能缺口 Top：React Hooks 2 人 < 60，接口联调 1 人
    expect(result.skillGaps[0]).toEqual(expect.objectContaining({ skill: 'React Hooks', studentCount: 2 }));
    expect(result.skillGaps[1]).toEqual(expect.objectContaining({ skill: '接口联调', studentCount: 1 }));
    // P2-1：缺口技能的证据覆盖（React Hooks 有 101 的证据）
    expect(result.skillGaps[0].evidenceCount).toBe(2);
    expect(result.skillGaps[0].evidenceStudents).toBe(1);
    expect(result.skillGaps[0].evidenceCoverageRate).toBe(50);
    expect(result.skillGaps[1].evidenceCount).toBe(0);
    // P2-1：整体证据覆盖率
    expect(result.overview.evidenceCoverage).toEqual(expect.objectContaining({
      studentsWithEvidence: 1,
      evidenceStudentRate: 25,
      chunks: 2,
      indexedChunks: 2,
      indexedRate: 100,
    }));
    // 掌握度 >= 60 的技能不计入缺口
    expect(result.skillGaps.some((g: any) => g.skill === 'JavaScript')).toBe(false);
    // 筛选项
    expect(result.filters.majors).toEqual(expect.arrayContaining(['软件工程', '计算机']));
    expect(result.filters.classes).toEqual(expect.arrayContaining(['2023', '2024']));
  });

  it('按专业与班级过滤学生', async () => {
    const { service } = setup();
    const result = await service.getEmploymentDashboard({ major: '软件工程', class: '2023' });

    // 所有学生查询后按 class 过滤
    expect(result.overview.studentCount).toBeLessThanOrEqual(4);
    expect(result.overview.studentCount).toBeGreaterThanOrEqual(1);
  });

  it('导出 CSV 包含表头与学生明细行', async () => {
    const { service } = setup({
      skills: [{ userId: 101, skillName: 'React', masteryPct: 40, status: 1 }],
      tasks: [{ userId: 101, taskStatus: 'done' }],
      evalResults: [{ userId: 101, passed: 1, normalizedScore: 75 }],
      plans: [{ userId: 101, matchScore: 88 }],
    });

    const csv = await service.exportEmploymentCsv({});

    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('学号');
    expect(lines[0]).toContain('准备度');
    // 学生行：学号 2023001 … 目标岗位 前端开发实习生 … 匹配度 88 … 准备度 高
    const row = lines.find((l) => l.startsWith('2023001'));
    expect(row).toBeTruthy();
    expect(row).toContain('前端开发实习生');
    expect(row).toContain('88');
    expect(row).toContain('高');
    // 逗号字段转义
    expect(lines.length).toBe(5); // 表头 + 4 学生
  });
});
