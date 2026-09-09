import { ResourceAgentService } from './resource-agent.service';

describe('ResourceAgentService domain context', () => {
  const llm = { chatCompletionComplete: jest.fn() };
  const knowledge = { saveLecture: jest.fn(), saveQuiz: jest.fn(), saveCoding: jest.fn(), getContent: jest.fn() };
  let service: ResourceAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResourceAgentService(llm as any, knowledge as any);
  });

  it('uses non-programming examples and English evidence for an English lecture', async () => {
    llm.chatCompletionComplete.mockResolvedValue({
      content: '# 六级写作表达\n'.repeat(80),
      complete: true,
      finishReason: 'stop',
      model: 'test-model',
    });
    knowledge.saveLecture.mockResolvedValue(undefined);

    await service.generateLecture('六级写作表达', 'intermediate', {
      domainId: 'english',
      domainName: '英语',
      goalTitle: '大学英语六级 CET-6',
      assessmentModes: ['作文批改'],
      evidenceTypes: ['作文版本'],
    });

    const messages = llm.chatCompletionComplete.mock.calls[0][0];
    expect(messages[0].content).toContain('跨学科教育内容设计师');
    expect(messages[1].content).toContain('学习领域：英语');
    expect(messages[1].content).toContain('作文批改');
    expect(messages[1].content).toContain('不要强行使用代码');
    expect(knowledge.saveLecture).toHaveBeenCalledWith(
      '六级写作表达',
      '# 六级写作表达\n'.repeat(80),
      'intermediate',
    );
  });

  it('passes mathematics assessment modes into generated practice', async () => {
    llm.chatCompletionComplete.mockResolvedValue({
      content: '[{"question":"q","options":["a","b","c","d"],"answer":0,"answerText":"a","explanation":"e"}]',
      complete: true,
      finishReason: 'stop',
      model: 'test-model',
    });
    knowledge.saveQuiz.mockResolvedValue(undefined);

    await service.generateQuiz('极限、导数与积分', 1, 'beginner', {
      domainId: 'mathematics',
      domainName: '数学',
      assessmentModes: ['分步解题', '错因诊断'],
      evidenceTypes: ['解题步骤'],
    });

    const prompt = llm.chatCompletionComplete.mock.calls[0][0][1].content;
    expect(prompt).toContain('适用评价方式：分步解题、错因诊断');
    expect(prompt).toContain('不要默认使用编程语境');
    expect(knowledge.saveQuiz).toHaveBeenCalled();
  });
});
