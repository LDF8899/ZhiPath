import { SkillService } from './skill.service';

describe('SkillService.getSkillEvidence', () => {
  function setup(overrides: {
    skills?: any[];
    commits?: any[];
    evalResults?: any[];
    student?: any;
    resumes?: any[];
    targetJob?: any;
  } = {}) {
    const userSkillRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.skills?.[0] || null),
      find: jest.fn().mockResolvedValue(overrides.skills || []),
      save: jest.fn(),
    };
    const studentRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.student ?? null),
    };
    const commitRepo = {
      find: jest.fn().mockResolvedValue(overrides.commits || []),
    };
    const evalResultRepo = {
      find: jest.fn().mockResolvedValue(overrides.evalResults || []),
    };
    const resumeRepo = {
      find: jest.fn().mockResolvedValue(overrides.resumes || []),
    };
    const jobRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.targetJob || null),
    };

    const service = new SkillService(
      userSkillRepo as any,
      studentRepo as any,
      commitRepo as any,
      evalResultRepo as any,
      resumeRepo as any,
      jobRepo as any,
    );

    return { service, commitRepo, evalResultRepo, resumeRepo, jobRepo };
  }

  const baseCommit = (id: number, skillName: string, extra: any = {}) => ({
    id,
    userId: 1,
    branchId: 7,
    commitType: 'lecture_read',
    skillName,
    message: `lecture read: ${skillName}`,
    payloadJson: null,
    snapshotId: 200,
    deltaJson: {
      skillChanges: [{ name: skillName, before: 0, after: 30, delta: 30 }],
      metricsChange: { overallScore: 30, matchScore: 8 },
    },
    createTime: 1730000000000,
    ...extra,
  });

  it('聚合学习/测评/项目/简历证据与岗位影响', async () => {
    const { service } = setup({
      skills: [{ id: 1, userId: 1, skillName: 'React', masteryPct: 70, source: 'exam', status: 1 }],
      commits: [baseCommit(101, 'React')],
      evalResults: [
        { id: 201, skillName: 'React', normalizedScore: 80, passed: 1, level: 'proficient', summary: '组件状态 8/10', createTime: 1730000000000 },
      ],
      student: {
        id: 1, userId: 1, targetJobId: 5, status: 1,
        projects: [
          { name: 'Todo 应用', description: '使用 React 构建任务管理模块', skills: ['React'], time: '2026-06' },
        ],
      },
      resumes: [
        {
          id: 301, version: 1, versionName: 'v1-前端开发',
          content: {
            targetJob: { title: '前端开发实习生' },
            skills: [{ name: 'React', masteryPct: 70 }],
            projects: [{ name: 'Todo 应用', description: '使用 React 构建任务管理模块' }],
          },
        },
      ],
      targetJob: { id: 5, title: '前端开发实习生' },
    });

    const result = await service.getSkillEvidence(1, 'React');

    expect(result.skill).toBe('React');
    expect(result.mastery).toBe(70);
    expect(result.hasSkill).toBe(true);
    expect(result.source).toBe('exam');
    // 学习证据
    expect(result.evidence.learning).toHaveLength(1);
    expect(result.evidence.learning[0]).toEqual(expect.objectContaining({
      commitId: 101,
      type: 'lecture_read',
      delta: 30,
    }));
    // 测评证据
    expect(result.evidence.evaluation).toHaveLength(1);
    expect(result.evidence.evaluation[0]).toEqual(expect.objectContaining({
      skillName: 'React',
      score: 80,
      passed: true,
    }));
    // 项目证据
    expect(result.evidence.project).toHaveLength(1);
    expect(result.evidence.project[0].name).toBe('Todo 应用');
    expect(result.evidence.project[0].skills).toContain('React');
    // 简历证据
    expect(result.evidence.resume).toHaveLength(1);
    expect(result.evidence.resume[0].resumeId).toBe(301);
    expect(result.evidence.resume[0].expression).toContain('React');
    // 岗位影响
    expect(result.evidence.impact).toEqual(expect.objectContaining({
      matchDelta: 8,
      commitId: 101,
      jobTitle: '前端开发实习生',
    }));
    // 汇总
    expect(result.counts).toEqual({ learning: 1, evaluation: 1, project: 1, resume: 1 });
    expect(result.summary).toContain('掌握度 70%');
  });

  it('无任何证据时返回空证据链与基础 summary', async () => {
    const { service } = setup();

    const result = await service.getSkillEvidence(1, 'Node.js');

    expect(result.mastery).toBe(0);
    expect(result.hasSkill).toBe(false);
    expect(result.counts).toEqual({ learning: 0, evaluation: 0, project: 0, resume: 0 });
    expect(result.evidence.learning).toEqual([]);
    expect(result.evidence.evaluation).toEqual([]);
    expect(result.evidence.project).toEqual([]);
    expect(result.evidence.resume).toEqual([]);
    expect(result.evidence.impact).toEqual(expect.objectContaining({ matchDelta: 0, jobTitle: '' }));
  });

  it('commit payload 提及技能也能命中学习证据', async () => {
    const { service } = setup({
      commits: [
        {
          id: 102,
          userId: 1,
          branchId: 8,
          commitType: 'task_done',
          skillName: null,
          message: 'task done: React Hooks',
          payloadJson: { skillName: 'React Hooks', taskId: 9 },
          snapshotId: null,
          deltaJson: null,
          createTime: 1730000000000,
        },
      ],
    });

    const result = await service.getSkillEvidence(1, 'React');

    expect(result.evidence.learning).toHaveLength(1);
    expect(result.evidence.learning[0].commitId).toBe(102);
  });

  it('无匹配度变化的 commit 不产生岗位影响', async () => {
    const { service } = setup({
      commits: [
        {
          id: 103,
          userId: 1,
          branchId: 7,
          commitType: 'task_done',
          skillName: 'React',
          message: 'task done: React',
          payloadJson: null,
          snapshotId: null,
          deltaJson: { skillChanges: [], metricsChange: { matchScore: 0 } },
          createTime: 1730000000000,
        },
      ],
    });

    const result = await service.getSkillEvidence(1, 'React');

    expect(result.evidence.learning).toHaveLength(1);
    expect(result.evidence.impact.matchDelta).toBe(0);
    expect(result.evidence.impact.commitId).toBeNull();
  });

  it('技能名大小写不敏感匹配（React hooks vs React）', async () => {
    const { service } = setup({
      commits: [baseCommit(104, 'React Hooks')],
      evalResults: [
        { id: 202, skillName: 'REACT', normalizedScore: 90, passed: 1, createTime: 1730000000000 },
      ],
    });

    const result = await service.getSkillEvidence(1, 'React');

    expect(result.evidence.learning).toHaveLength(1);
    expect(result.evidence.evaluation).toHaveLength(1);
  });
});
