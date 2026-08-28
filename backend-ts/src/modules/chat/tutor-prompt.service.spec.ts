import { TutorPromptService } from './tutor-prompt.service';

describe('TutorPromptService multi-domain behavior', () => {
  const service = new TutorPromptService();

  it('guides new users by domain and goal instead of assuming a job', () => {
    const prompt = service.buildTutorPrompt(null, null, 'home');
    expect(prompt).toContain('面向多专业、多目标');
    expect(prompt).toContain('考试、课程、证书、项目、兴趣还是职业发展');
    expect(prompt).toContain('只有用户明确表达求职意图时才推荐岗位');
  });

  it('includes learning domain goals in the profile context', () => {
    const prompt = service.buildTutorPrompt({
      goals: {
        learning_domain_id: 'mathematics',
        goal_type: 'exam',
        goal_title: '考研数学',
      },
    });
    expect(prompt).toContain('学习领域：mathematics');
    expect(prompt).toContain('当前学习目标：考研数学');
    expect(prompt).toContain('数学重步骤');
  });
});
