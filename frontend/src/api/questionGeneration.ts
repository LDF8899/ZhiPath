import client from './client';
import type { ApiResponse } from '../types';
import { zhipathPlatformApi } from './platform';
import { createIdempotencyKey } from '@zhipath/api-client';
import { PlatformApiError } from '@zhipath/api-client';

const isLegacyFallbackError = (error: unknown) => error instanceof PlatformApiError && [404, 405].includes(Number(error.code));

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
  list: async (limit = 20) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/question-generation/tasks', { query: { limit } }) } as ApiResponse<any[]>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/question-generation/tasks', { params: { limit } }) as Promise<ApiResponse<any[]>>; } },
  create: async (config: GenerationConfig) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/question-generation/tasks', { method: 'POST', body: config, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-question-create') } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/question-generation/tasks', config) as Promise<ApiResponse<any>>; } },
  start: async (taskId: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/start`, { method: 'POST' }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/question-generation/tasks/${taskId}/start`) as Promise<ApiResponse<any>>; } },
  snapshot: async (taskId: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/snapshot`) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/question-generation/tasks/${taskId}/snapshot`) as Promise<ApiResponse<any>>; } },
  saveSnapshot: async (taskId: number, payload: any) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/snapshot`, { method: 'PUT', body: payload }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.put(`/user/question-generation/tasks/${taskId}/snapshot`, payload) as Promise<ApiResponse<any>>; } },
  persistDrafts: async (taskId: number, questions: any[]) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/batch`, { method: 'POST', body: { questions } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/question-generation/tasks/${taskId}/questions/batch`, { questions }) as Promise<ApiResponse<any>>; } },
  approve: async (taskId: number, questionIds: number[], questionsMap?: Record<string, any>) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/approve`, { method: 'PATCH', body: { questionIds, questionsMap } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.patch(`/user/question-generation/tasks/${taskId}/questions/approve`, { questionIds, questionsMap }) as Promise<ApiResponse<any>>; } },
  updateDraft: async (taskId: number, questionId: number, question: any) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/${questionId}`, { method: 'PATCH', body: { question } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.patch(`/user/question-generation/tasks/${taskId}/questions/${questionId}`, { question }) as Promise<ApiResponse<any>>; } },
  remove: async (taskId: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/question-generation/tasks/${taskId}`, { method: 'DELETE' }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.delete(`/user/question-generation/tasks/${taskId}`) as Promise<ApiResponse<any>>; } },
};
