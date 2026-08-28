import client from './client';
import type { ApiResponse } from '../types';

export interface GenerationConfig {
  subject: string;
  curriculum?: string;
  locale?: string;
  grade?: string;
  questionTypes: string[];
  count: number;
  difficulty: number;
  difficultyMix?: Record<string, number>;
  topics?: Array<{ id?: string | number; label?: string; [key: string]: any }>;
  instructions?: string;
  metadata?: Record<string, any>;
  referenceLibrary?: boolean;
}

export const questionGenerationApi = {
  list: (limit = 20) => client.get('/user/question-generation/tasks', { params: { limit } }) as Promise<ApiResponse<any[]>>,
  create: (config: GenerationConfig) => client.post('/user/question-generation/tasks', config) as Promise<ApiResponse<any>>,
  start: (taskId: number) => client.post(`/user/question-generation/tasks/${taskId}/start`) as Promise<ApiResponse<any>>,
  snapshot: (taskId: number) => client.get(`/user/question-generation/tasks/${taskId}/snapshot`) as Promise<ApiResponse<any>>,
  saveSnapshot: (taskId: number, payload: any) => client.put(`/user/question-generation/tasks/${taskId}/snapshot`, payload) as Promise<ApiResponse<any>>,
  persistDrafts: (taskId: number, questions: any[]) => client.post(`/user/question-generation/tasks/${taskId}/questions/batch`, { questions }) as Promise<ApiResponse<any>>,
  approve: (taskId: number, questionIds: number[], questionsMap?: Record<string, any>) => client.patch(`/user/question-generation/tasks/${taskId}/questions/approve`, { questionIds, questionsMap }) as Promise<ApiResponse<any>>,
  updateDraft: (taskId: number, questionId: number, question: any) => client.patch(`/user/question-generation/tasks/${taskId}/questions/${questionId}`, { question }) as Promise<ApiResponse<any>>,
  remove: (taskId: number) => client.delete(`/user/question-generation/tasks/${taskId}`) as Promise<ApiResponse<any>>,
};
