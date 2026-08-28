import { QuickTestService } from './quick-test.service';

describe('QuickTestService domain assessment', () => {
  it('uses the English domain pass score and persists its rubric contract', async () => {
    const examRepo = { save: jest.fn(async (value) => ({ ...value, id: 51 })) };
    const learningCommit = {
      commitSkill: jest.fn().mockResolvedValue({
        commit: { id: 71 },
        snapshot: { id: 81, skillsJson: [] },
        delta: { radarChanges: [] },
        branch: { id: 91 },
        matchSummary: null,
      }),
    };
    const evaluation = { record: jest.fn(async (value) => ({ result: value })) };
    const context = {
      planId: 23,
      domainId: 'english',
      domainName: '英语',
      goalType: 'exam',
      goalTitle: '大学英语六级 CET-6',
      passScore: 60,
      assessmentModes: ['分项练习', '限时模拟'],
      evidenceTypes: ['练习正确率', '模拟卷成绩'],
      terminology: { assessment: '水平测评' },
      radarDimensions: [
        { id: 'listening', name: '听力理解', category: 'english:listening', skills: ['六级听力理解'], weight: 1 },
      ],
      currentAbilityName: '六级听力理解',
    };
    const assessmentContext = {
      resolve: jest.fn().mockResolvedValue(context),
      rubricKey: jest.fn().mockReturnValue('english_quick_test_v1'),
      dimensionForSkill: jest.fn().mockReturnValue(context.radarDimensions[0]),
    };
    const service = new QuickTestService(
      {} as any,
      examRepo as any,
      {} as any,
      {} as any,
      learningCommit as any,
      evaluation as any,
      assessmentContext as any,
    );
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: `q${index + 1}`,
      type: 'choice',
      answer: 0,
      explanation: '',
    }));
    const answers = { q1: 0, q2: 0, q3: 0, q4: 1, q5: 1 };

    const result = await service.submitAnswers(8, '六级听力理解', answers, questions);

    expect(result.score).toBe(60);
    expect(result.passed).toBe(true);
    expect(learningCommit.commitSkill).toHaveBeenCalledWith(8, undefined, expect.objectContaining({
      payload: expect.objectContaining({ passScore: 60, domainId: 'english' }),
    }));
    expect(evaluation.record).toHaveBeenCalledWith(expect.objectContaining({
      rubricKey: 'english_quick_test_v1',
      passScore: 60,
      metadata: expect.objectContaining({ domainId: 'english', goalTitle: '大学英语六级 CET-6' }),
      evidence: expect.objectContaining({ assessmentModes: ['分项练习', '限时模拟'] }),
    }));
  });
});
