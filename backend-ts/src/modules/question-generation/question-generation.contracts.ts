export interface TopicRef {
  id?: string | number;
  code?: string;
  label?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface GenerationConfig {
  subject: string;
  curriculum: string;
  locale: string;
  grade: string;
  questionTypes: string[];
  count: number;
  difficulty: number;
  difficultyMix: Record<string, number>;
  topics: TopicRef[];
  instructions: string;
  metadata: Record<string, any>;
  referenceLibrary?: boolean;
}

export interface QuestionOption {
  key: string;
  text: string;
  [key: string]: any;
}

export interface QuestionPart {
  label?: string;
  question: string;
  answer?: any;
  solution?: string;
  marks?: number;
  [key: string]: any;
}

export interface GeoGebraFigure {
  type: 'geogebra';
  commands: string[];
  view?: [number, number, number, number];
  axes?: boolean;
  grid?: boolean;
}

export interface NormalizedQuestion {
  id?: string | number;
  clientId?: string;
  type: string;
  stem: string;
  options: QuestionOption[];
  answer: any;
  solution: string;
  parts: QuestionPart[];
  metadata: Record<string, any>;
  figure?: GeoGebraFigure | null;
  [key: string]: any;
}

export interface GenerationProgress {
  current: number;
  total: number;
  failed: number;
  message: string;
}

export const TERMINAL_TASK_STATUSES = ['completed', 'failed', 'cancelled'] as const;

export function normalizeGenerationConfig(input: any = {}): GenerationConfig {
  const source = input && typeof input === 'object' ? input : {};
  const rawTypes = Array.isArray(source.questionTypes)
    ? source.questionTypes
    : source.question_type ? [source.question_type] : ['choice'];
  const count = Number.isFinite(Number(source.count)) ? Math.trunc(Number(source.count)) : 5;
  const difficulty = Number.isFinite(Number(source.difficulty)) ? Math.trunc(Number(source.difficulty)) : 5;
  return {
    subject: String(source.subject || source.skillName || '').trim(),
    curriculum: String(source.curriculum || '').trim(),
    locale: String(source.locale || 'zh-CN'),
    grade: String(source.grade || '').trim(),
    questionTypes: Array.from(new Set(rawTypes.map((value: any) => String(value || '').trim().toLowerCase()).filter(Boolean))) as string[],
    count: Math.min(100, Math.max(1, count)),
    difficulty: Math.min(10, Math.max(1, difficulty)),
    difficultyMix: Object.fromEntries(Object.entries(source.difficultyMix || {}).map(([key, value]) => [key, Math.max(0, Math.trunc(Number(value) || 0))])),
    topics: Array.isArray(source.topics) ? source.topics.filter(Boolean) : [],
    instructions: String(source.instructions || ''),
    metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {},
    referenceLibrary: Boolean(source.referenceLibrary ?? source.reference_library ?? source.metadata?.referenceLibrary ?? false),
  };
}

export function validateGenerationConfig(input: any): { valid: boolean; errors: string[]; config: GenerationConfig } {
  const config = normalizeGenerationConfig(input);
  const errors: string[] = [];
  if (!config.subject) errors.push('subject is required');
  if (!config.questionTypes.length) errors.push('at least one question type is required');
  if (config.count < 1 || config.count > 100) errors.push('count must be between 1 and 100');
  return { valid: errors.length === 0, errors, config };
}

export function normalizeQuestion(raw: any, index = 0): NormalizedQuestion {
  const source = raw && typeof raw === 'object' ? raw : {};
  const type = String(source.type || source.questionType || source.question_type || 'choice').trim().toLowerCase();
  const stem = String(source.stem ?? source.question ?? source.question_text ?? '').trim();
  const options = Array.isArray(source.options) ? source.options.map((option: any, optionIndex: number) => ({
    ...((option && typeof option === 'object') ? option : {}),
    key: String(option?.key ?? String.fromCharCode(65 + optionIndex)),
    text: String(option?.text ?? option?.label ?? option?.value ?? option ?? ''),
  })) : [];
  return {
    ...source,
    clientId: String(source.clientId ?? source.id ?? source.question_id ?? `generated-${index + 1}`),
    type,
    stem,
    options,
    answer: source.answer ?? source.answer_key ?? '',
    solution: String(source.solution ?? source.explanation ?? ''),
    parts: Array.isArray(source.parts) ? source.parts : [],
    metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {},
  };
}

export function normalizeQuestions(items: any[]): NormalizedQuestion[] {
  return (Array.isArray(items) ? items : []).map(normalizeQuestion).filter((item) => item.stem.length > 0);
}
