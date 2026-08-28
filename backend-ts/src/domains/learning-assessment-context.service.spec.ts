import { LearningAssessmentContextService } from './learning-assessment-context.service';
import { LearningDomainRegistry } from './learning-domain.registry';

describe('LearningAssessmentContextService', () => {
  const planRepo = { findOne: jest.fn() };
  const service = new LearningAssessmentContextService(planRepo as any, new LearningDomainRegistry());

  beforeEach(() => jest.clearAllMocks());

  it('materializes the active English plan into scoring and radar contracts', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 23,
      domainId: 'english',
      goalType: 'exam',
      goalTitle: '大学英语六级 CET-6',
      planName: '大学英语六级 CET-6',
      currentPhase: 1,
      pathData: {
        phases: [
          {
            name: '诊断与词汇',
            skills: [
              { abilityId: 'cet6-diagnostic', name: 'CET-6 入门诊断', status: 'done' },
              { abilityId: 'cet6-vocabulary', name: '六级高频词汇与语境辨析', status: 'done' },
            ],
          },
          {
            name: '听力与阅读',
            skills: [
              { abilityId: 'cet6-listening', name: '六级听力理解', status: 'pending' },
              { abilityId: 'cet6-reading', name: '六级阅读理解', status: 'pending' },
            ],
          },
        ],
      },
    });

    const context = await service.resolve(8);

    expect(context).toEqual(expect.objectContaining({
      domainId: 'english',
      passScore: 60,
      currentAbilityName: '六级听力理解',
    }));
    expect(context?.radarDimensions.find((item) => item.id === 'listening')?.skills).toEqual(['六级听力理解']);
    expect(service.dimensionForSkill(context, '六级阅读理解')?.name).toBe('阅读理解');
    expect(service.rubricKey(context, 'quick_test')).toBe('english_quick_test_v1');
  });

  it('returns null when the learner has no active core plan', async () => {
    planRepo.findOne.mockResolvedValue(null);
    await expect(service.resolve(8)).resolves.toBeNull();
  });
});
