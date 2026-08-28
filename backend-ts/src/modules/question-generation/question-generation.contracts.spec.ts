import { normalizeGenerationConfig, normalizeQuestion, validateGenerationConfig } from './question-generation.contracts';

describe('question generation contracts', () => {
  it('normalizes legacy config aliases and bounds values', () => {
    const result = normalizeGenerationConfig({ subject: ' React ', question_type: 'MC', count: 999, difficulty: 0 });
    expect(result.subject).toBe('React');
    expect(result.questionTypes).toEqual(['mc']);
    expect(result.count).toBe(100);
    expect(result.difficulty).toBe(1);
  });

  it('rejects a config without a subject or type', () => {
    const result = validateGenerationConfig({ subject: '', questionTypes: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['subject is required', 'at least one question type is required']));
  });

  it('maps provider question fields to the shared shape', () => {
    const question = normalizeQuestion({ question: 'What is JSX?', options: ['A', { text: 'B' }], answer_key: 'A', explanation: 'It is syntax.' });
    expect(question.type).toBe('choice');
    expect(question.stem).toBe('What is JSX?');
    expect(question.options).toEqual([{ key: 'A', text: 'A' }, { text: 'B', key: 'B' }]);
    expect(question.answer).toBe('A');
    expect(question.solution).toBe('It is syntax.');
  });
});
