import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const STORAGE = sessionStorage;

// 清除旧 localStorage 残留（一次性迁移）
localStorage.removeItem('zhpath_token');
localStorage.removeItem('zhpath_user');

/** 验证 user 对象是否包含必要字段 */
function isValidUser(u: any): u is User {
  return u && typeof u === 'object' && typeof u.role === 'string' && typeof u.username === 'string';
}

// 初始化时验证存储的 user 是否有效
const _storedUser = (() => {
  try {
    const raw = STORAGE.getItem('zhpath_user');
    const parsed = raw ? JSON.parse(raw) : null;
    return isValidUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
})();
const _storedToken = STORAGE.getItem('zhpath_token');
const _validAuth = !!_storedToken && !!_storedUser;

// 如果 token 存在但 user 无效，清除残留数据
if (_storedToken && !_validAuth) {
  STORAGE.removeItem('zhpath_token');
  STORAGE.removeItem('zhpath_user');
}

export const useAuthStore = create<AuthState>((set) => ({
  token: _validAuth ? _storedToken : null,
  user: _storedUser,
  isAuthenticated: _validAuth,

  setAuth: (token, user) => {
    if (!isValidUser(user)) {
      console.error('[Auth] setAuth 收到无效 user 对象:', user);
      return;
    }
    STORAGE.setItem('zhpath_token', token);
    STORAGE.setItem('zhpath_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    STORAGE.removeItem('zhpath_token');
    STORAGE.removeItem('zhpath_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  updateUser: (partial) =>
    set((state) => {
      const user = state.user ? { ...state.user, ...partial } : null;
      if (user) STORAGE.setItem('zhpath_user', JSON.stringify(user));
      return { user };
    }),
}));
