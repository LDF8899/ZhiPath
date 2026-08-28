import { SkillSnapshotService } from './skill-snapshot.service';

describe('SkillSnapshotService', () => {
  const repo = { save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
  let service: SkillSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SkillSnapshotService(repo as any, { resolve: jest.fn().mockResolvedValue(null) } as any);
  });

  it('calculates fixed radar dimensions and ability metrics', () => {
    const skills = service.normalizeSkills([
      { name: 'JavaScript', masteryPct: 80, trustWeight: 1, source: 'exam' },
      { name: 'React', masteryPct: 60, trustWeight: 1, source: 'exam' },
      { name: 'Git', masteryPct: 70, trustWeight: 1, source: 'exam' },
      { name: 'Node.js', masteryPct: 40, trustWeight: 1, source: 'exam' },
    ]);

    const radar = service.calculateRadarData(skills);
    const metrics = service.calculateAbilityMetrics(skills, radar, 20, 30);

    expect(radar).toHaveLength(6);
    expect(radar.find((d) => d.name === '前端基础')?.score).toBe(80);
    expect(radar.find((d) => d.name === '前端框架')?.score).toBe(60);
    expect(radar.find((d) => d.name === '工程化')?.score).toBe(70);
    expect(metrics.depth).toBe(80);
    expect(metrics.breadth).toBe(67);
    expect(metrics.learningSpeed).toBe(20);
    expect(metrics.consistency).toBe(30);
  });

  it('calculates commit delta for skills, radar, and metrics', () => {
    const before: any = {
      skillsJson: [{ name: 'Git', mastery: 30, effectiveMastery: 30 }],
      radarJson: [{ name: '工程化', score: 30 }],
      totalMastery: 10,
      depthScore: 30,
      breadthScore: 10,
    };
    const after: any = {
      skillsJson: [{ name: 'Git', mastery: 60, effectiveMastery: 60 }],
      radarJson: [{ name: '工程化', score: 60 }],
      totalMastery: 20,
      depthScore: 60,
      breadthScore: 20,
    };

    const delta = service.calculateDelta(before, after, 5);

    expect(delta.skillChanges).toEqual([{ name: 'Git', before: 30, after: 60, delta: 30 }]);
    expect(delta.radarChanges).toEqual([{ dimension: '工程化', before: 30, after: 60, delta: 30 }]);
    expect(delta.metricsChange).toEqual({
      overallScore: 10,
      matchScore: 5,
      depthScore: 30,
      breadthScore: 10,
    });
  });

  it('persists radar dimensions from the active learning domain', async () => {
    const context = {
      resolve: jest.fn().mockResolvedValue({
        domainId: 'english',
        domainName: '英语',
        goalTitle: '大学英语六级 CET-6',
        radarDimensions: [
          { id: 'listening', name: '听力理解', category: 'english:listening', skills: ['六级听力理解'], weight: 0.5 },
          { id: 'reading', name: '阅读理解', category: 'english:reading', skills: ['六级阅读理解'], weight: 0.5 },
        ],
      }),
    };
    const domainService = new SkillSnapshotService(repo as any, context as any);
    repo.save.mockImplementation(async (value) => value);

    const snapshot: any = await domainService.saveSnapshot({
      userId: 1,
      branchId: 2,
      commitId: 3,
      skills: [
        { name: '六级听力理解', masteryPct: 80, trustWeight: 1, source: 'exam' },
        { name: '六级阅读理解', masteryPct: 60, trustWeight: 1, source: 'exam' },
      ],
    });

    expect(snapshot.radarJson.map((item: any) => item.name)).toEqual(['听力理解', '阅读理解']);
    expect(snapshot.abilityMetricsJson).toEqual(expect.objectContaining({
      overallScore: 70,
      domainId: 'english',
      domainName: '英语',
    }));
  });
});
