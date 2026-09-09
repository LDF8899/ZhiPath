import { PlatformRequest, getRequestContext } from '../request-context/request-context.types';

export interface ApiV1Meta {
  requestId: string;
  client: string;
}

export interface ApiV1Response<T> {
  data: T;
  meta: ApiV1Meta;
}

export function apiV1Success<T>(request: PlatformRequest, data: T): ApiV1Response<T> {
  const context = getRequestContext(request);
  return {
    data,
    meta: {
      requestId: context.requestId,
      client: context.clientApp,
    },
  };
}
