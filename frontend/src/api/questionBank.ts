import client from './client';
import { zhipathPlatformApi } from './platform';
import { createIdempotencyKey, PlatformApiError } from '@zhipath/api-client';
import type { ApiResponse } from '../types';

const isLegacyFallbackError = (error: unknown) => error instanceof PlatformApiError && [404, 405].includes(Number(error.code));

export interface BankQuestion {
  id: number;
  type: string;
  title: string;
  options: string[];
  difficulty: number;
  confidence: number | null;
  skillName: string | null;
  source: 'generated' | 'imported' | 'manual' | 'enterprise';
}

export interface PageResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

export const questionBankApi = {
  list: async (params: { skillName?: string; questionType?: string; difficulty?: string; source?: string; page?: number; pageSize?: number }) => {
    try {
      const result = await zhipathPlatformApi.request<any>('/v1/question-bank/questions', { query: params });
      return { code: 200, message: 'success', data: result?.items || [], total: result?.pageInfo?.total || 0, page: result?.pageInfo?.page || params.page || 1, pageSize: result?.pageInfo?.pageSize || params.pageSize || 20 } as PageResponse<BankQuestion>;
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return client.get('/user/question-bank/questions', { params }) as Promise<PageResponse<BankQuestion>>;
    }
  },
  assemble: async (questionIds: number[]) => {
    try {
      return { code: 200, message: 'success', data: await zhipathPlatformApi.request<{ examId: number; questionCount: number }>('/v1/question-bank/assemble', { method: 'POST', body: { questionIds }, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-question-bank-assemble') } }) } as ApiResponse<{ examId: number; questionCount: number }>;
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return client.post('/user/question-bank/assemble', { questionIds }) as Promise<ApiResponse<{ examId: number; questionCount: number }>>;
    }
  },
};
