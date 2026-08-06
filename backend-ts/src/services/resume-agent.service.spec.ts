import { ResumeAgentService } from './resume-agent.service';

describe('ResumeAgentService HTML generation', () => {
  const content = {
    personalInfo: {
      name: '<龙>',
      school: '北京大学',
      major: '软件工程',
      grade: '大三',
    },
    skills: [
      { name: 'JavaScript', masteryPct: 25, source: 'self_report' },
      { name: 'Node.js', masteryPct: 55, source: 'self_report' },
    ],
    projects: [
      {
        name: '个人博客',
        description: '基于 React 的全栈博客系统',
        techStack: ['React', 'Node.js'],
        role: '全栈开发',
      },
    ],
    workExperience: [],
    campusExperience: [],
    awards: [],
    targetJob: {
      title: '前端开发工程师',
      company: '字节跳动',
      requiredSkills: [{ name: 'JavaScript' }],
    },
  };

  function createService(llmResult: string) {
    const service = Object.create(ResumeAgentService.prototype) as ResumeAgentService;
    (service as any).llmService = {
      chatCompletion: jest.fn().mockResolvedValue(llmResult),
    };
    // Evidence RAG（P0）：默认无证据
    (service as any).evidenceRag = {
      search: jest.fn().mockResolvedValue([]),
    };
    return service;
  }

  it('renders a complete document from source data when LLM returns garbage', async () => {
    const service = createService('```html garbage');

    const html = await (service as any).generateHtml(content, content.targetJob);

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
    expect(html).toContain('&lt;龙&gt;');
    expect(html).toContain('前端开发工程师');
    expect(html).toContain('JavaScript');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('uses grounded copy enhancements without allowing HTML injection', async () => {
    const service = createService(JSON.stringify({
      summary: '聚焦前端工程能力',
      jobIntent: '求职意向：前端开发工程师',
      skillCategories: [
        { category: '前端 & 跨端', items: '熟练React、JavaScript' },
        { category: '后端 & 数据库', items: '熟练Node.js' },
      ],
      projectDetails: {
        0: ['<strong>全栈开发</strong>独立完成前后端设计与实现'],
      },
      projectResults: { 0: '✦ 已上线运行' },
      selfEvaluation: ['热爱技术，持续学习'],
    }));

    const html = await (service as any).generateHtml(content, content.targetJob);

    expect(html).toContain('聚焦前端工程能力');
    expect(html).toContain('熟练React、JavaScript');
    expect(html).toContain('<strong>全栈开发</strong>');
    expect(html).not.toContain('<龙>');
    expect(html).toContain('&lt;龙&gt;');
  });

  it('fallbacks to auto-categorization when LLM returns no skill categories', async () => {
    const service = createService(JSON.stringify({
      summary: '',
      projectDetails: {},
      projectResults: {},
      selfEvaluation: [],
    }));

    const html = await (service as any).generateHtml(content, content.targetJob);

    // Should auto-categorize JavaScript → frontend, Node.js → backend
    expect(html).toContain('前端');
    expect(html).toContain('后端');
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  it('builds target-job resume advice from matched and missing skills', async () => {
    const service = createService('{}');
    // P1-2：evidence-aware — 每个技能返回不同证据强度
    const evidenceBySkill: Record<string, any> = {
      React: {
        mastery: 72,
        evidence: {
          learning: [],
          evaluation: [{ passed: true, score: 80, summary: '组件状态题 8/10' }],
          project: [],
          resume: [],
          impact: {},
        },
      },
      Vite: {
        mastery: 60,
        evidence: {
          learning: [{ commitId: 1, type: 'lecture_read', message: 'lecture read: Vite', delta: 5, time: 1730000000000 }],
          evaluation: [],
          project: [],
          resume: [],
          impact: {},
        },
      },
      TypeScript: {
        mastery: 0,
        evidence: { learning: [], evaluation: [], project: [], resume: [], impact: {} },
      },
    };
    (service as any).skillService = {
      getSkillEvidence: jest.fn(async (_userId: number, name: string) => evidenceBySkill[name] || evidenceBySkill.TypeScript),
    };
    // P0：RAG 召回 React 项目证据 → 建议携带 evidenceRefs
    (service as any).evidenceRag.search = jest.fn(async (_userId: number, name: string) =>
      name === 'React'
        ? [{ chunkId: 501, sourceType: 'project', title: '项目证据：就业看板', snippet: '使用 React 和 TypeScript 完成…', score: 0.9 }]
        : [],
    );

    const advice = await (service as any).buildResumeAdvice(
      7,
      {
        title: 'Web 前端实习生',
        company: '示例科技',
        requiredSkills: [{ name: 'React' }, { name: 'TypeScript' }],
        preferredSkills: [{ name: 'Vite' }],
      },
      [
        { name: 'React', masteryPct: 72 },
        { name: 'Vite', masteryPct: 60 },
      ],
      [],
    );

    expect(advice.matchedSkills).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'React', masteryPct: 72 }),
    ]));
    expect(advice.missingSkills).toContain('TypeScript');
    expect(advice.actionItems.join('')).toContain('TypeScript');
    // P1-2：evidence-aware 表达建议
    expect(advice.expressions.length).toBeGreaterThanOrEqual(3);
    const bySkill = Object.fromEntries(advice.expressions.map((e: any) => [e.skills[0], e]));
    // React 有测评通过证据 → high
    expect(bySkill.React.confidence).toBe('high');
    expect(bySkill.React.evidence.type).toBe('evaluation');
    expect(bySkill.React.advice).toContain('组件状态题 8/10');
    // P0：RAG 召回的 React 项目证据进入建议引用
    expect(bySkill.React.evidenceRefs).toHaveLength(1);
    expect(bySkill.React.evidenceRefs[0]).toEqual(expect.objectContaining({
      chunkId: 501,
      sourceType: 'project',
      title: expect.stringContaining('就业看板'),
    }));
    // Vite 只有学习证据 → medium + warning
    expect(bySkill.Vite.confidence).toBe('medium');
    expect(bySkill.Vite.warning).toContain('速测');
    // TypeScript 无证据 → low + 提示补证据
    expect(bySkill.TypeScript.confidence).toBe('low');
    expect(bySkill.TypeScript.warning).toContain('补项目或测评');
    expect(bySkill.TypeScript.advice).toContain('避免过度包装');
  });
});
