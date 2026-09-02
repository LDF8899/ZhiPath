import { CompetitionService } from './competition.service';

describe('CompetitionService', () => {
  let service: CompetitionService;

  beforeEach(() => {
    service = new CompetitionService();
  });

  it('provides CodeNova demo cases for at least three learner profiles', () => {
    const result = service.getDemoCases();

    expect(result.project.name).toContain('CodeNova');
    expect(result.learners).toHaveLength(3);
    expect(result.domain.knowledgeSlice.length).toBeGreaterThanOrEqual(5);
  });

  it('runs a full analyze-generate-review-decision loop', () => {
    const result = service.runLoop({ learnerId: 'undergrad-project', quizAccuracy: 88 });

    expect(result.learner.id).toBe('undergrad-project');
    expect(result.agents.length).toBeGreaterThanOrEqual(5);
    expect(result.resources.map((item) => item.type)).toEqual(['lecture', 'labGuide', 'stagedQuiz']);
    expect(result.evidenceTrail.length).toBeGreaterThanOrEqual(3);
    expect(result.debate.map((item) => item.agent)).toContain('审核裁判 Agent');
    expect(result.decision.action).toBe('进阶挑战');
    expect(result.report.citationCoverage).toBeGreaterThanOrEqual(85);
  });

  it('selects remediation strategy from quiz accuracy', () => {
    expect(service.feedback({ learnerId: 'freshman-foundation', quizAccuracy: 52 }).decision.action).toBe('降维解释');
    expect(service.feedback({ learnerId: 'freshman-foundation', quizAccuracy: 72 }).decision.action).toBe('补弱巩固');
    expect(service.feedback({ learnerId: 'freshman-foundation', quizAccuracy: 90 }).decision.action).toBe('进阶挑战');
  });
});
