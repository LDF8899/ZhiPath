import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { questionGenerationApi } from '../api/questionGeneration';
import type { GenerationConfig } from '../api/questionGeneration';

export type GeneratorStatus = 'idle' | 'starting' | 'running' | 'reviewing' | 'saving' | 'approving' | 'done' | 'error';

const DEFAULT_CONFIG: GenerationConfig = {
  subject: '', questionTypes: ['choice'], count: 5, difficulty: 5, locale: 'zh-CN', topics: [], instructions: '', metadata: {},
};

export function useQuestionGenerator(initialConfig: Partial<GenerationConfig> = {}, pollIntervalMs = 1500) {
  const [config, setConfig] = useState<GenerationConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const [task, setTask] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0, message: '' });
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [error, setError] = useState('');
  const runToken = useRef(0);
  const taskId = task?.taskId || task?.id || null;
  const busy = useMemo(() => ['starting', 'running', 'saving', 'approving'].includes(status), [status]);

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return;
    setTask((previous: any) => ({ ...(previous || {}), ...snapshot }));
    const persistedIds = Array.isArray(snapshot.persistedQuestionIds) ? snapshot.persistedQuestionIds : [];
    setQuestions(Array.isArray(snapshot.questions) ? snapshot.questions.map((question: any, index: number) => ({ ...question, id: question.id ?? persistedIds[index] })) : []);
    setReviewStatuses(Array.isArray(snapshot.reviewStatuses) ? snapshot.reviewStatuses : []);
    setProgress(snapshot.progress || { current: snapshot.resultCount || 0, total: snapshot.questionCount || 0, failed: 0, message: '' });
    if (snapshot.taskStatus === 'completed') setStatus('reviewing');
    if (snapshot.taskStatus === 'failed') { setStatus('error'); setError(snapshot.errorMessage || '生成失败'); }
  }, []);

  const refresh = useCallback(async (id: number) => {
    const response = await questionGenerationApi.snapshot(id);
    applySnapshot(response.data);
    return response.data;
  }, [applySnapshot]);

  const poll = useCallback(async (id: number, token: number) => {
    const snapshot = await refresh(id);
    const next = snapshot?.taskStatus;
    if (token !== runToken.current || ['completed', 'failed', 'cancelled'].includes(next)) return;
    window.setTimeout(() => { poll(id, token).catch((caught) => { setError(caught?.message || String(caught)); setStatus('error'); }); }, pollIntervalMs);
  }, [pollIntervalMs, refresh]);

  const start = useCallback(async (nextConfig: GenerationConfig = config) => {
    if (!nextConfig.subject.trim() || !nextConfig.questionTypes.length) { setError('请填写主题并选择题型'); setStatus('error'); return null; }
    const token = ++runToken.current;
    setConfig(nextConfig); setQuestions([]); setReviewStatuses([]); setError(''); setStatus('starting');
    try {
      const created = await questionGenerationApi.create(nextConfig);
      setTask(created.data);
      const id = created.data?.taskId || created.data?.id;
      if (!id) throw new Error('服务端没有返回任务 ID');
      await questionGenerationApi.start(Number(id));
      setStatus('running');
      await poll(Number(id), token);
      return created.data;
    } catch (caught: any) { setError(caught?.message || String(caught)); setStatus('error'); return null; }
  }, [config, poll]);

  const saveDrafts = useCallback(async () => {
    if (!taskId) return null;
    setStatus('saving');
    try {
      const result = await questionGenerationApi.persistDrafts(Number(taskId), questions);
      const ids = result.data?.questionIds || [];
      if (ids.length) setQuestions((current) => current.map((question, index) => ({ ...question, id: question.id ?? ids[index] })));
      setStatus('reviewing');
      await refresh(Number(taskId));
      return result.data;
    }
    catch (caught: any) { setError(caught?.message || String(caught)); setStatus('error'); return null; }
  }, [questions, refresh, taskId]);

  const approve = useCallback(async (ids: number[], questionsMap?: Record<string, any>) => {
    if (!taskId) return null;
    setStatus('approving');
    try { const result = await questionGenerationApi.approve(Number(taskId), ids, questionsMap); setStatus('done'); await refresh(Number(taskId)); return result.data; }
    catch (caught: any) { setError(caught?.message || String(caught)); setStatus('error'); return null; }
  }, [refresh, taskId]);

  useEffect(() => () => { runToken.current += 1; }, []);
  return { config, setConfig, task, taskId, questions, setQuestions, reviewStatuses, progress, status, error, busy, start, refresh, saveDrafts, approve };
}
