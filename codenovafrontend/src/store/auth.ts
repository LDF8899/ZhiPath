import { create } from 'zustand';
import { authApi, clearAuth, getToken, setToken, USER_KEY, type AuthUser } from '../lib/api';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  markOnboarded: () => void;
};

function readUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: readUser(),
  ready: false,

  setSession: (token, user) => {
    setToken(token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    clearAuth();
    set({ token: null, user: null, ready: true });
  },

  /** 刷新 /me，失败（401 或后端未启动）不算致命，保留本地会话 */
  refresh: async () => {
    if (!getToken()) return null;
    try {
      const me = await authApi.me();
      const next: AuthUser = { ...me, onboardingCompleted: Boolean(me.onboardingCompleted) };
      sessionStorage.setItem(USER_KEY, JSON.stringify(next));
      set({ user: next });
      return next;
    } catch {
      return null;
    }
  },

  bootstrap: async () => {
    if (!getToken()) {
      set({ ready: true, token: null, user: null });
      return;
    }
    await get().refresh();
    set({ ready: true });
  },

  markOnboarded: () => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, onboardingCompleted: true };
    sessionStorage.setItem(USER_KEY, JSON.stringify(next));
    set({ user: next });
  },
}));
