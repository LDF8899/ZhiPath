import type { GenerationConfig } from './api';

const PENDING_QUESTION_CONFIG_KEY = 'codenova_pending_question_config';

export function setPendingQuestionConfig(config: Partial<GenerationConfig> | null | undefined) {
  if (typeof window === 'undefined') return;
  if (!config) {
    sessionStorage.removeItem(PENDING_QUESTION_CONFIG_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_QUESTION_CONFIG_KEY, JSON.stringify(config));
}

export function takePendingQuestionConfig(): Partial<GenerationConfig> | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PENDING_QUESTION_CONFIG_KEY);
  sessionStorage.removeItem(PENDING_QUESTION_CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function peekPendingQuestionConfig(): Partial<GenerationConfig> | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PENDING_QUESTION_CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
