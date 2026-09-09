import { Request } from 'express';

export type ClientAppKey = string;

export interface RequestContext {
  requestId: string;
  clientApp: ClientAppKey;
  clientVersion: string;
  startedAt: number;
}

export interface PlatformRequest extends Request {
  requestContext?: RequestContext;
  user?: {
    sub?: number;
    id?: number;
    username?: string;
    role?: string;
    tenantId?: number;
    scopes?: string[];
    roles?: string[];
    azp?: string;
  };
}

export function getRequestContext(request: PlatformRequest): RequestContext {
  return request.requestContext || {
    requestId: 'untracked',
    clientApp: 'unknown',
    clientVersion: 'unknown',
    startedAt: Date.now(),
  };
}
