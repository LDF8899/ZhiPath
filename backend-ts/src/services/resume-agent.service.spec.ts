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
});
