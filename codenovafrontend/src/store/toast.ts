import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';
export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  desc?: string;
};

type ToastState = {
  items: Toast[];
  push: (tone: ToastTone, title: string, desc?: string, ttl?: number) => number;
  dismiss: (id: number) => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (tone, title, desc, ttl = 4200) => {
    const id = ++seq;
    set({ items: [...get().items, { id, tone, title, desc }] });
    if (ttl > 0) {
      setTimeout(() => get().dismiss(id), ttl);
    }
    return id;
  },
  dismiss: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
}));

export const toast = {
  success: (title: string, desc?: string) => useToastStore.getState().push('success', title, desc),
  error: (title: string, desc?: string) => useToastStore.getState().push('error', title, desc, 6000),
  info: (title: string, desc?: string) => useToastStore.getState().push('info', title, desc),
  warn: (title: string, desc?: string) => useToastStore.getState().push('warn', title, desc, 5200),
};
