import { ExamsService } from './exams.service';

describe('ExamsService domain assessment', () => {
  it('uses the legal domain pass score and writes domain evidence', async () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      questionType: 'choice',
      title: `法律题 ${index + 1}`,
      answer: 0,
      skillName: '法律案例分析',
      difficulty: 2,
      status: 1,
    }));
    const examRepo = {
      save: jest.fn(async (value) => ({ ...value, id: 61 })),
      createQueryBuilder: jest.fn(() => ({
        where() { return this; },
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const questionRepo = {
      find: jest.fn().mockResolvedValue(questions),
      update: jest.fn(),
    };
    const learningCommit = {
      commitSkill: jest.fn().mockResolvedValue({
        commit: { id: 72 },
        snapshot: { id: 82, skillsJson: [] },
        delta: { radarChanges: [] },
        branch: { id: 92 },
        matchSummary: null,
      }),
    };
    const evaluation = { record: jest.fn(async (value) => ({ result: value })) };
    const context = {
      planId: 24,
      domainId: 'legal-studies',
      domainName: '法律',
      goalType: 'certificate',
      goalTitle: '国家统一法律职业资格考试',
      passScore: 60,
      assessmentModes: ['法条辨析', '案例分析'],
      evidenceTypes: ['法条引用', '案例论证'],
      terminology: { assessment: '案例评价' },
      radarDimensions: [
        { id: 'case-argument', name: '案例与论证', category: 'legal:case', skills: ['法律案例分析'], weight: 1 },
      ],
    };
    const assessmentContext = {
      resolve: jest.fn().mockResolvedValue(context),
      rubricKey: jest.fn().mockReturnValue('legal-studies_exam_v1'),
      dimensionForSkill: jest.fn().mockReturnValue(context.radarDimensions[0]),
    };
    const service = new ExamsService(
      examRepo as any,
      questionRepo as any,
      {} as any,
      { analyzeErrors: jest.fn() } as any,
      {} as any,
      learningCommit as any,
      evaluation as any,
      assessmentContext as any,
    );
    const answers = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 };

    const result: any = await service.submitExam(8, {
      examType: 1,
      skillName: '法律案例分析',
      answers,
    });

    expect(result.score).toBe(60);
    expect(result.passed).toBe(1);
    expect(evaluation.record).toHaveBeenCalledWith(expect.objectContaining({
      rubricKey: 'legal-studies_exam_v1',
      passScore: 60,
      evidenceType: 'exam_answer',
      metadata: expect.objectContaining({ domainId: 'legal-studies' }),
      evidence: expect.objectContaining({ evidenceTypes: ['法条引用', '案例论证'] }),
    }));
  });
});
