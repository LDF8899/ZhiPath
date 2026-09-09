import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { zhipathPlatformApi, zhipathTokenStore } from './platform';

let refreshPromise: Promise<string> | null = null;

const client = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s（LangGraph 需要流超时 + fallback 时间）
  headers: {
    'Content-Type': 'application/json',
    'X-Client-App': 'zhipath-web',
    'X-Client-Version': import.meta.env.VITE_APP_VERSION || 'dev',
  },
});

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `zhipath-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// 请求拦截：自动注入 token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = createRequestId();
  }
  return config;
});

// 响应拦截：统一错误处理
client.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    if (error.response?.status === 401) {
      const original = error.config as any;
      const state = useAuthStore.getState();
      const canRefresh =
        Boolean(state.refreshToken) &&
        !original?._retry &&
        !String(original?.url || '').includes('/v1/auth/refresh');
      if (canRefresh) {
        original._retry = true;
        refreshPromise ||= zhipathPlatformApi
          .refreshAccessToken()
          .then((accessToken) => {
            if (!accessToken) throw new Error('刷新令牌无效或已过期');
            const current = useAuthStore.getState();
            if (!current.user) throw new Error('本地用户会话不存在');
            current.setAuth(accessToken, current.user, zhipathTokenStore.getRefreshToken());
            return accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
        try {
          const accessToken = await refreshPromise;
          original.headers.Authorization = `Bearer ${accessToken}`;
          return client.request(original);
        } catch {
          // 轮换失败后统一清理本地会话。
        }
      }
      // 清除旧 localStorage 残留（从 localStorage 迁移到 sessionStorage 的过渡）
      localStorage.removeItem('zhpath_token');
      localStorage.removeItem('zhpath_user');
      useAuthStore.getState().logout();
      window.location.href = '/';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default client;
