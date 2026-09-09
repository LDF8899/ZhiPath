import { createPlatformApiClient, PlatformTokenStore } from '@zhipath/api-client';

export const zhipathTokenStore = new PlatformTokenStore(sessionStorage, {
  accessToken: 'zhpath_token',
  refreshToken: 'zhpath_refresh_token',
});

export const zhipathPlatformApi = createPlatformApiClient({
  clientApp: 'zhipath-web',
  clientVersion: import.meta.env.VITE_APP_VERSION || 'dev',
  tokenStore: zhipathTokenStore,
});
