import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const client = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s（LangGraph 需要流超时 + fallback 时间）
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：自动注入 token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一错误处理
client.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
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
