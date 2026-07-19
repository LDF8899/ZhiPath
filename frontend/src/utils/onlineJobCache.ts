import type { Job } from '../types';

const STORAGE_KEY = 'zhipath_selected_online_job';

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
