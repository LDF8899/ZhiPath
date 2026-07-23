import type { Job } from '../types';

const STORAGE_KEY = 'zhipath_selected_online_job';
const SEARCH_CACHE_KEY = 'zhipath_job_search_cache_v1';
const LAST_SEARCH_KEY = 'zhipath_last_job_search_v1';
const SEARCH_TTL_MS = 15 * 60 * 1000;

export interface CachedJobSearchState {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  keyword: string;
  level: string;
  searchMode: 'hybrid' | 'local' | 'online';
  searchMeta: Record<string, any> | null;
  storedAt: number;
}

export function storeOnlineJob(job: Job): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(job));
}

export function readOnlineJob(jobId: number): Job | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const job = raw ? JSON.parse(raw) as Job : null;
    if (!job || Number(job.id) !== jobId || !job.title || job.source !== 'online') return null;
    return job;
  } catch {
    return null;
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isFresh(storedAt: number): boolean {
  return Number.isFinite(storedAt) && Date.now() - storedAt < SEARCH_TTL_MS;
}

export function jobSearchCacheKey(params: {
  page: number;
  pageSize: number;
  keyword: string;
  level: string;
  searchMode: 'hybrid' | 'local' | 'online';
}): string {
  return [
    params.searchMode,
    params.page,
    params.pageSize,
    params.keyword.trim().toLowerCase(),
    params.level.trim().toLowerCase(),
  ].join('|');
}

export function readJobSearchCache(key: string): CachedJobSearchState | null {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const all = JSON.parse(storage.getItem(SEARCH_CACHE_KEY) || '{}') as Record<string, CachedJobSearchState>;
    const cached = all[key];
    return cached && isFresh(cached.storedAt) ? cached : null;
  } catch {
    return null;
  }
}

export function storeJobSearchCache(key: string, state: Omit<CachedJobSearchState, 'storedAt'>): void {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    const all = JSON.parse(storage.getItem(SEARCH_CACHE_KEY) || '{}') as Record<string, CachedJobSearchState>;
    all[key] = { ...state, storedAt: Date.now() };
    const entries = Object.entries(all)
      .filter(([, value]) => isFresh(value.storedAt))
      .sort((a, b) => b[1].storedAt - a[1].storedAt)
      .slice(0, 20);
    storage.setItem(SEARCH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore cache write failures.
  }
}

export function readLastJobSearchState(): CachedJobSearchState | null {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(LAST_SEARCH_KEY) || 'null') as CachedJobSearchState | null;
    return cached && isFresh(cached.storedAt) ? cached : null;
  } catch {
    return null;
  }
}

export function storeLastJobSearchState(state: Omit<CachedJobSearchState, 'storedAt'>): void {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(LAST_SEARCH_KEY, JSON.stringify({ ...state, storedAt: Date.now() }));
  } catch {
    // Ignore cache write failures.
  }
}
