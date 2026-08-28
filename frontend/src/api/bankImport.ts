import client from './client';
import type { ApiResponse } from '../types';

export const questionBankImportApi = {
  import: (payload: { filename?: string; fileType?: string; images: string[] }) => client.post('/user/question-bank/imports', payload) as Promise<ApiResponse<any>>,
  list: (limit = 20) => client.get('/user/question-bank/imports', { params: { limit } }) as Promise<ApiResponse<any[]>>,
  detail: (id: number) => client.get(`/user/question-bank/imports/${id}`) as Promise<ApiResponse<any>>,
  confirm: (id: number, candidateIds: number[]) => client.post(`/user/question-bank/imports/${id}/confirm`, { candidateIds }) as Promise<ApiResponse<any>>,
  remove: (id: number) => client.delete(`/user/question-bank/imports/${id}`) as Promise<ApiResponse<any>>,
};
