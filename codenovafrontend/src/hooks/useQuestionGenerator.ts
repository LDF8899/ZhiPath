import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  questionGenerationApi,
  type GeneratedQuestion,
  type GenerationConfig,
  type QuestionGenerationSnapshot,
} from '../lib/api';

export type GeneratorStatus = 'idle' | 'starting' | 'running' | 'reviewing' | 'saving' | 'approving' | 'done' | 'error';

const DEFAULT_CONFIG: GenerationConfig = {
  subject: '',
  questionTypes: ['choice'],
  count: 5,
  difficulty: 5,
  locale: 'zh-CN',
  topics: [],
  instructions: '',
  metadata: {},
  referenceLibrary: true,
};

function normalizeInitialConfig(input: Partial<GenerationConfig> = {}): GenerationConfig {
  const questionTypes = Array.isArray(input.questionTypes) && input.questionTypes.length ? input.questionTypes : DEFAULT_CONFIG.questionTypes;
  return {
    ...DEFAULT_CONFIG,
    ...input,
    subject: String(input.subject || (input as any).skillName || DEFAULT_CONFIG.subject),
    questionTypes,
    count: Math.min(100, Math.max(1, Number(input.count || DEFAULT_CONFIG.count))),
    difficulty: Math.min(10, Math.max(1, Number(input.difficulty || DEFAULT_CONFIG.difficulty))),
    topics: Array.isArray(input.topics) ? input.topics : [],
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
}

export function useQuestionGenerator(initialConfig: Partial<GenerationConfig> = {}, pollIntervalMs = 1500) {
  const [config, setConfig] = useState<GenerationConfig>(() => normalizeInitialConfig(initialConfig));
  const [task, setTask] = useState<QuestionGenerationSnapshot | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0, message: '' });
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [error, setError] = useState('');
  const runToken = useRef(0);

  const taskId = task?.taskId || task?.id || null;
  const busy = useMemo(() => ['starting', 'running', 'saving', 'approving'].includes(status), [status]);

  const applySnapshot = useCallback((snapshot: QuestionGenerationSnapshot | null | undefined) => {
    if (!snapshot) return;
    setTask((previous) => ({ ...(previous || {}), ...snapshot }));
    if (snapshot.config) setConfig((current) => ({ ...current, ...snapshot.config }));

    const persistedIds = Array.isArray(snapshot.persistedQuestionIds) ? snapshot.persistedQuestionIds : [];
    const nextQuestions = Array.isArray(snapshot.questions)
      ? snapshot.questions.map((question, index) => ({ ...question, id: question.id ?? persistedIds[index] }))
      : [];
    setQuestions(nextQuestions);
    setReviewStatuses(Array.isArray(snapshot.reviewStatuses) ? snapshot.reviewStatuses : nextQuestions.map(() => 'pending'));
    setProgress(snapshot.progress || { current: snapshot.resultCount || 0, total: snapshot.questionCount || 0, failed: 0, message: '' });

    if (snapshot.taskStatus === 'completed') setStatus('reviewing');
    if (snapshot.taskStatus === 'failed') {
      setStatus('error');
      setError(snapshot.errorMessage || '生成失败');
    }
  }, []);

  const refresh = useCallback(async (id: number) => {
    const snapshot = await questionGenerationApi.snapshot(id);
    applySnapshot(snapshot);
    return snapshot;
  }, [applySnapshot]);

  const poll = useCallback(async (id: number, token: number) => {
    const snapshot = await refresh(id);
    const next = snapshot?.taskStatus;
    if (token !== runToken.current || ['completed', 'failed', 'cancelled'].includes(String(next))) return;
    window.setTimeout(() => {
      poll(id, token).catch((caught) => {
        setError(caught?.message || String(caught));
        setStatus('error');
      });
    }, pollIntervalMs);
  }, [pollIntervalMs, refresh]);

  const start = useCallback(async (nextConfig: GenerationConfig = config) => {
    const normalized = normalizeInitialConfig(nextConfig);
    if (!normalized.subject.trim() || !normalized.questionTypes.length) {
      setError('请填写主题并至少选择一种题型');
      setStatus('error');
      return null;
    }

    const token = ++runToken.current;
    setConfig(normalized);
    setTask(null);
    setQuestions([]);
    setReviewStatuses([]);
    setError('');
    setStatus('starting');

    try {
      const created = await questionGenerationApi.create(normalized);
      setTask(created);
      const id = created.taskId || created.id;
      if (!id) throw new Error('服务端没有返回任务 ID');
      await questionGenerationApi.start(Number(id));
      setStatus('running');
      await poll(Number(id), token);
      return created;
    } catch (caught: any) {
      setError(caught?.message || String(caught));
      setStatus('error');
      return null;
    }
  }, [config, poll]);

  const saveDrafts = useCallback(async () => {
    if (!taskId) return null;
    setStatus('saving');
    try {
      const result = await questionGenerationApi.persistDrafts(Number(taskId), questions);
      const ids = result.questionIds || [];
      if (ids.length) {
        setQuestions((current) => current.map((question, index) => ({ ...question, id: question.id ?? ids[index] })));
      }
      setStatus('reviewing');
      await refresh(Number(taskId));
      return result;
    } catch (caught: any) {
      setError(caught?.message || String(caught));
      setStatus('error');
      return null;
    }
  }, [questions, refresh, taskId]);

  const approve = useCallback(async (ids: number[], questionsMap?: Record<string, GeneratedQuestion>) => {
    if (!taskId) return null;
    setStatus('approving');
    try {
      const result = await questionGenerationApi.approve(Number(taskId), ids, questionsMap);
      setStatus('done');
      await refresh(Number(taskId));
      return result;
    } catch (caught: any) {
      setError(caught?.message || String(caught));
      setStatus('error');
      return null;
    }
  }, [refresh, taskId]);

  useEffect(() => () => {
    runToken.current += 1;
  }, []);

  return {
    config,
    setConfig,
    task,
    taskId,
    questions,
    setQuestions,
    reviewStatuses,
    progress,
    status,
    error,
    busy,
    start,
    refresh,
    saveDrafts,
    approve,
  };
}
