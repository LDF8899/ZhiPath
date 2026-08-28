import client from './client';
import type { ApiResponse } from '../types';

export const remediationApi = {
  weakPoints: () => client.get('/user/remediation/weak-points') as Promise<ApiResponse<Array<{ label: string; masteryPct: number }>>>,
  prepare: (payload: { count?: number; difficulty?: number; questionTypes?: string[]; topics?: Array<{ label: string }> }) => client.post('/user/remediation/prepare', payload) as Promise<ApiResponse<{ weakPoints: Array<{ label: string; masteryPct: number }>; config: any }>>,
  generate: (payload: { count?: number; difficulty?: number; questionTypes?: string[]; topics?: Array<{ label: string }> }) => client.post('/user/remediation/generate', payload) as Promise<ApiResponse<any>>,
  history: (limit = 10) => client.get('/user/remediation/history', { params: { limit } }) as Promise<ApiResponse<Array<{ id: number; taskId: number | null; createTime: number; topics: Array<{ label: string; beforeMastery: number; currentMastery: number; delta: number }> }>>>,
};
