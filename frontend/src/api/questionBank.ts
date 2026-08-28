import client from './client';
import type { ApiResponse } from '../types';

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
  list: (params: { skillName?: string; questionType?: string; difficulty?: string; source?: string; page?: number; pageSize?: number }) => client.get('/user/question-bank/questions', { params }) as Promise<PageResponse<BankQuestion>>,
  assemble: (questionIds: number[]) => client.post('/user/question-bank/assemble', { questionIds }) as Promise<ApiResponse<{ examId: number; questionCount: number }>>,
};
