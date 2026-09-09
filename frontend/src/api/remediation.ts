import client from './client';
import { createIdempotencyKey, PlatformApiError } from '@zhipath/api-client';
import { zhipathPlatformApi } from './platform';
import type { ApiResponse } from '../types';

const isLegacyFallbackError = (error: unknown) => error instanceof PlatformApiError && [404, 405].includes(Number(error.code));

export const remediationApi = {
  weakPoints: async () => {
    try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/remediation/weak-points') } as ApiResponse<any[]>; }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/remediation/weak-points') as Promise<ApiResponse<any[]>>; }
  },
  prepare: async (payload: { count?: number; difficulty?: number; questionTypes?: string[]; topics?: Array<{ label: string }> }) => {
    try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/remediation/prepare', { method: 'POST', body: payload }) } as ApiResponse<any>; }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/remediation/prepare', payload) as Promise<ApiResponse<any>>; }
  },
  generate: async (payload: { count?: number; difficulty?: number; questionTypes?: string[]; topics?: Array<{ label: string }> }) => {
    try {
      return {
        code: 200,
        message: 'success',
        data: await zhipathPlatformApi.request<any>('/v1/remediation/generate', {
          method: 'POST',
          body: payload,
          headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-remediation') },
          timeoutMs: 240_000,
        }),
      } as ApiResponse<any>;
    }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/remediation/generate', payload) as Promise<ApiResponse<any>>; }
  },
  history: async (limit = 10) => {
    try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/remediation/history', { query: { limit } }) } as ApiResponse<any[]>; }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/remediation/history', { params: { limit } }) as Promise<ApiResponse<any[]>>; }
  },
};
