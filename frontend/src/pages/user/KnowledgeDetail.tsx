import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  getKnowledge,
  markRead,
  submitQuiz,
  markComplete,
  markCodeComplete,
  getMasteryBreakdown,
  updateSkillMastery,
  generateCode,
  generateReading,
  assessLearning,
  createAgentOfficeTask,
  getAgentOfficeTask,
  generateAnimation,
  generateDiagram,
  generateVideo,
  generateAvatar,
  getMultimodal,
} from '../../api/user';
import { useSessionProgress } from '../../hooks/useSession';
import { useWorkspaceStore } from '../../stores/workspace';
import AnimationCard from '../../components/AnimationCard';
import DiagramCard from '../../components/DiagramCard';
import VideoCard from '../../components/VideoCard';
import AvatarCard from '../../components/AvatarCard';
import '../../styles/hand-draw.css';
import {
  IconArrowLeft,
  IconBook,
  IconCheck,
  IconCode,
  IconDocument,
  IconLightbulb,
  IconWarning,
  IconX,
  IconChart,
  IconClock,
  IconTarget,
  IconRefresh,
  IconImage,
} from '../../components/icons';

/* ──────────────────────────────────────────
   TypeScript Interfaces
   ────────────────────────────────────────── */

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface CodeExample {
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  language: string;
  setup: string;
  task: string;
  hint: string;
  solution: string;
  solutionExplanation: string[];
  expectedOutput: string;
  commonMistakes: string[];
  keyPoints: string[];
  relatedConcepts: string[];
  // Agent 返回的替代字段
  code?: string;
  comments?: string[];
  output?: string;
}

interface ReadingItem {
  title: string;
  type: 'why' | 'practice' | 'deep' | 'compare';
  content: string;
  keyConcepts: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  readTime: string;
  relatedTopics: string[];
  questions: string[];
}

interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  detail: string;
  trend: 'up' | 'stable' | 'down';
}

interface WeakPoint {
  skill: string;
  level: 'low' | 'medium';
  description: string;
  suggestion: string;
}

interface Improvement {
  priority: 'high' | 'medium' | 'low';
  area: string;
  action: string;
  expectedEffect: string;
}

interface AssessData {
  overallScore: number;
  level: string;
  dimensions: DimensionScore[];
  weakPoints: WeakPoint[];
  improvements: Improvement[];
  planAdjustment: string;
  encouragement: string;
  summary: string;
}

interface KnowledgeData {
  skill: string;
  lecture: string | null;
  quiz: QuizQuestion[] | null;
  coding: CodeExample[] | null;
  reading: ReadingItem[] | null;
  has_content: boolean;
}

type TabKey = 'lecture' | 'quiz' | 'code' | 'reading' | 'assess' | 'multimodal';

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */

const difficultyColor = (d: string) => {
  if (d === 'basic') return { color: '#3a7d3a', bg: 'var(--note-green)' };
  if (d === 'intermediate') return { color: '#8a6d00', bg: 'var(--note-yellow)' };
  return { color: 'var(--accent)', bg: 'var(--note-pink)' };
};

const difficultyLabel = (d: string) => {
  if (d === 'basic') return '基础';
  if (d === 'intermediate') return '中等';
  return '高级';
};

/** 标准化代码示例 — 兼容 Agent 返回的 code/comments/output 字段 */
function normalizeCodeExample(c: CodeExample) {
  const code = c.code || '';
  return {
    ...c,
    // setup 只用 Agent 明确提供的，不 fallback 到完整代码（避免泄露答案）
    setup: c.setup || '',
    solution: c.solution || code,
    solutionExplanation: c.solutionExplanation?.length ? c.solutionExplanation : (c.comments || []),
    expectedOutput: c.expectedOutput || c.output || '',
  };
}

/* ──────────────────────────────────────────
   Radar Chart SVG (pure SVG, no library)
   ────────────────────────────────────────── */

function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 100;
  const count = dimensions.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid lines */}
      {gridLevels.map((level) => {
        const pts = Array.from({ length: count }, (_, i) => {
          const p = getPoint(i, level);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={level === 100 ? 1.5 : 0.8}
            strokeDasharray={level === 100 ? 'none' : '4 3'}
          />
        );
      })}

      {/* Axes */}
      {dimensions.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--rule)" strokeWidth={0.8} />;
      })}

      {/* Score polygon */}
      {(() => {
        const pts = dimensions.map((d, i) => {
          const p = getPoint(i, d.score);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            points={pts}
            fill="rgba(216,72,43,0.2)"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        );
      })()}

      {/* Score dots */}
      {dimensions.map((d, i) => {
        const p = getPoint(i, d.score);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--accent)" stroke="var(--paper)" strokeWidth={1.5} />;
      })}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const p = getPoint(i, 115);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ font: '12px/1 var(--hand)', fill: 'var(--ink)' }}
          >
            {d.dimension}
          </text>
        );
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────
   Main Component
   ────────────────────────────────────────── */

export default function KnowledgeDetail() {
  const { skill } = useParams<{ skill: string }>();
  const navigate = useNavigate();

  /* ── State ── */
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('lecture');
  const [readDone, setReadDone] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  /* Code tab state */
  const [codeEditors, setCodeEditors] = useState<Record<number, string>>({});
  const [codeOutputs, setCodeOutputs] = useState<Record<number, string>>({});
  const [codeExpanded, setCodeExpanded] = useState<Record<number, boolean>>({});
  const [codeSolutions, setCodeSolutions] = useState<Record<number | string, boolean>>({});
  const [generatingCode, setGeneratingCode] = useState(false);

  /* Reading tab state */
  const [readingExpanded, setReadingExpanded] = useState<Record<number, boolean>>({});
  const [generatingReading, setGeneratingReading] = useState(false);
  const [studyAdvice, setStudyAdvice] = useState<string | null>(null);

  /* Dispatched task polling */
  const [pollingTaskId, setPollingTaskId] = useState<number | null>(null);

  /* Deeper learning state */
  const [generatingDeeper, setGeneratingDeeper] = useState(false);

  /* Assessment tab state */
  const [assessData, setAssessData] = useState<AssessData | null>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessDone, setAssessDone] = useState(false);

  /* Multimodal tab state */
  const [mmData, setMmData] = useState<{ animation: any; diagram: any; video: any; avatar: any } | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmGenerating, setMmGenerating] = useState<Record<string, boolean>>({});

  /* Completion tracking */
  const [codePracticed, setCodePracticed] = useState(false);
  const [readingDone, setReadingDone] = useState(false);

  /* Mastery breakdown */
  const [masteryData, setMasteryData] = useState<{
    masteryPct: number;
    breakdown: Record<string, { done: boolean; weight: number; label: string }>;
  } | null>(null);

  /* 学习会话进度记录 */
  const { recordProgress } = useSessionProgress();

  /* Toast */
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  };

  /* ── Fetch knowledge ── */
  const fetchKnowledge = useCallback(async (isPoll = false) => {
    if (!skill) return;
    const decoded = decodeURIComponent(skill);
    // 拒绝无效技能名（"未知"、"未知技能"等 fallback 值）
    if (!decoded || decoded === '未知' || decoded === '未知技能') {
      setData({
        skill: decoded,
        lecture: null, quiz: null, coding: null, reading: null,
        has_content: false,
      });
      setLoading(false);
      setGenerating(false);
      return;
    }
    try {
      const res = await getKnowledge(decodeURIComponent(skill));
      if (res.code === 200) {
        const d = res.data;
        if (d.has_content) {
          setData(d);
          setGenerating(false);
          setLoading(false);
          return;
        }
        if (d.generating && !isPoll) {
          setGenerating(true);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }
    if (!isPoll) {
      setData({
        skill: decodeURIComponent(skill),
        lecture: `# ${decodeURIComponent(skill)} 学习资料\n\n内容生成中，请稍候...`,
        quiz: [],
        coding: [],
        reading: [],
        has_content: false,
      });
      setLoading(false);
    }
  }, [skill]);

  useEffect(() => { fetchKnowledge(); }, [fetchKnowledge]);

  /* ── Fetch mastery breakdown ── */
  const fetchMastery = useCallback(async () => {
    if (!skill) return;
    try {
      const res = await getMasteryBreakdown(decodeURIComponent(skill));
      if (res.code === 200 && res.data) {
        setMasteryData(res.data);
        // 同步已完成状态
        if (res.data.breakdown?.lecture?.done) setReadDone(true);
        if (res.data.breakdown?.code?.done) setCodePracticed(true);
      }
    } catch { /* ignore */ }
  }, [skill]);

  useEffect(() => { fetchMastery(); }, [fetchMastery]);

  /* Polling when generating */
  useEffect(() => {
    if (!generating || pollCount >= 20) return;
    const timer = setTimeout(() => {
      setPollCount(prev => prev + 1);
      fetchKnowledge(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [generating, pollCount, fetchKnowledge]);

  /* ── Mark read ── */
  const handleMarkRead = async () => {
    const masteryBefore = masteryData?.masteryPct ?? 0;
    try {
      const res = await markRead(decodeURIComponent(skill!), 0);
      if (res.code === 200 && res.data?.masteryPct !== undefined) {
        showToast(`讲义已读完，掌握度 +${res.data.delta}% → ${res.data.masteryPct}%`);
        recordProgress(0, decodeURIComponent(skill!), masteryBefore, res.data.masteryPct);
        // 工作区事件：讲义阅读完成触发技能完成
        try {
          useWorkspaceStore.getState().emit({
            type: 'skill_completed',
            skillName: decodeURIComponent(skill!),
            newMatchScore: res.data.newMatchScore,
            delta: res.data?.delta,
            snapshot: res.data?.snapshot,
          } as any);
        } catch { /* optional */ }
      } else {
        showToast('已标记为已读');
      }
    } catch { showToast('已标记为已读'); }
    setReadDone(true);
    fetchMastery(); // 刷新掌握度
  };

  /* ── Quiz submit ── */
  const handleQuizSubmit = async () => {
    if (!data?.quiz) return;
    const total = data.quiz.length;
    const correct = data.quiz.filter((q, i) => quizAnswers[i] === q.answer).length;
    const masteryBefore = masteryData?.masteryPct ?? 0;
    try {
      const res: any = await submitQuiz(decodeURIComponent(skill!), total, correct, 0);
      if (res.code === 200) {
        setQuizResult({ score: res.data.score, passed: res.data.passed });
        if (res.data.passed && res.data.masteryPct !== undefined) {
          showToast(`习题通过！掌握度 +${res.data.delta}% → ${res.data.masteryPct}%`);
          recordProgress(0, decodeURIComponent(skill!), masteryBefore, res.data.masteryPct);
        }
        // 工作区事件：考试完成
        try {
          useWorkspaceStore.getState().emit({
            type: 'exam_completed',
            skillName: decodeURIComponent(skill!),
            passed: res.data.passed,
            score: res.data.score,
            trustWeightChange: res.data?.trustWeightChange ?? 0,
          });
        } catch { /* optional */ }
      }
    } catch {
      const score = Math.round((correct / total) * 100);
      setQuizResult({ score, passed: score >= 70 }); // 阈值 70%
    }
    setQuizSubmitted(true);
    fetchMastery(); // 刷新掌握度
  };

  /* ── Code tab: generate code examples ── */
  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await generateCode({ skillName: decodeURIComponent(skill!) });
      if (res.code === 200 && res.data) {
        const coding = res.data.coding || res.data;
        setData(prev => prev ? { ...prev, coding: Array.isArray(coding) ? coding : [coding] } : prev);
      }
    } catch { showToast('生成代码案例失败', 'error'); }
    setGeneratingCode(false);
  };

  /* ── Code tab: run code ── */
  const handleRunCode = (index: number, code: string) => {
    const logs: string[] = [];
    const fakeConsole = { log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')) };
    try {
      const fn = new Function('console', code);
      fn(fakeConsole);
      setCodeOutputs(prev => ({ ...prev, [index]: logs.join('\n') || '(无输出)' }));
    } catch (err: any) {
      setCodeOutputs(prev => ({ ...prev, [index]: `错误: ${err.message}` }));
    }
  };

  /* ── Mark code complete ── */
  const handleMarkCodeComplete = async () => {
    const masteryBefore = masteryData?.masteryPct ?? 0;
    try {
      const res = await markCodeComplete(decodeURIComponent(skill!), 0);
      if (res.code === 200 && res.data?.masteryPct !== undefined) {
        showToast(`编程实战完成！掌握度 +${res.data.delta}% → ${res.data.masteryPct}%`);
        recordProgress(0, decodeURIComponent(skill!), masteryBefore, res.data.masteryPct);
        // 工作区事件：编程完成也是技能完成
        try {
          useWorkspaceStore.getState().emit({
            type: 'skill_completed',
            skillName: decodeURIComponent(skill!),
            newMatchScore: res.data.newMatchScore,
            delta: res.data?.delta,
            snapshot: res.data?.snapshot,
          } as any);
        } catch { /* optional */ }
      } else {
        showToast('编程题已标记完成');
      }
    } catch { showToast('编程题已标记完成'); }
    setCodePracticed(true);
    fetchMastery(); // 刷新掌握度
  };

  /* ── Reading tab: generate reading ── */
  const handleGenerateReading = async () => {
    setGeneratingReading(true);
    try {
      const res = await generateReading({ skillName: decodeURIComponent(skill!) });
      if (res.code === 200 && res.data) {
        const reading = res.data.reading || res.data;
        const advice = res.data.studyAdvice || null;
        setData(prev => prev ? { ...prev, reading: Array.isArray(reading) ? reading : [reading] } : prev);
        if (advice) setStudyAdvice(advice);
      }
    } catch { showToast('生成拓展阅读失败', 'error'); }
    setGeneratingReading(false);
  };

  /* ── Lecture tab: generate deeper content ── */
  const handleGenerateDeeper = async () => {
    setGeneratingDeeper(true);
    try {
      const skillName = decodeURIComponent(skill!);
      const res = await generateLecture({ skillName, level: 'intermediate', extra: '请深入讲解底层原理、设计决策、边界情况和高级用法。假设学生已经学过基础内容，现在想要深入理解。' });
      if (res.code === 200 && res.data) {
        const newContent = res.data.content || res.data.markdown || '';
        if (newContent) {
          setData(prev => prev ? { ...prev, lecture: prev.lecture + '\n\n---\n\n## 深入学习\n\n' + newContent } : prev);
          showToast('深入内容已生成');
        }
      }
    } catch { showToast('生成深入内容失败', 'error'); }
    setGeneratingDeeper(false);
  };

  /* ── Assessment tab: load on demand ── */
  const handleLoadAssess = async () => {
    if (assessData || assessLoading) return;
    setAssessLoading(true);
    try {
      const skillName = decodeURIComponent(skill!);
      const learningData = `技能: ${skillName}, 已读: ${readDone}, 测验分数: ${quizResult?.score ?? '未完成'}`;
      const res = await assessLearning({
        learningData,
        goal: `掌握 ${skillName}`,
        currentProgress: `讲义${readDone ? '已' : '未'}读, 测验${quizSubmitted ? '已' : '未'}提交`,
      });
      if (res.code === 200 && res.data) {
        setAssessData(res.data);
        setAssessDone(true);
      }
    } catch { showToast('加载评估失败', 'error'); }
    setAssessLoading(false);
  };

  /* ── Multimodal tab: load existing resources ── */
  const fetchMultimodal = useCallback(async () => {
    if (!skill) return;
    setMmLoading(true);
    try {
      const res = await getMultimodal(decodeURIComponent(skill));
      if (res.code === 200 && res.data) {
        setMmData({
          animation: res.data.animation,
          diagram: res.data.diagram,
          video: res.data.video,
          avatar: res.data.avatar,
        });
      }
    } catch { /* ignore */ }
    setMmLoading(false);
  }, [skill]);

  /* ── Multimodal: generate one modality ── */
  const handleGenerateMm = async (kind: 'animation' | 'diagram' | 'video' | 'avatar') => {
    const skillName = decodeURIComponent(skill!);
    setMmGenerating((p) => ({ ...p, [kind]: true }));
    try {
      let res: any;
      if (kind === 'animation') res = await generateAnimation({ skillName });
      else if (kind === 'diagram') res = await generateDiagram({ skillName, diagramType: 'flowchart' });
      else if (kind === 'video') res = await generateVideo({ skillName });
      else res = await generateAvatar({ skillName });

      // 后端返回 { code, data: { type, data } }（多模态 action 信封）
      const payload = res?.data?.data ?? res?.data;
      if (res.code === 200 && payload) {
        if (res.data?.type === 'error') {
          showToast(res.data.message || '生成失败', 'error');
        } else {
          setMmData((prev) => ({ ...(prev || { animation: null, diagram: null, video: null, avatar: null }), [kind]: payload }));
        }
      } else {
        showToast('生成失败', 'error');
      }
    } catch { showToast('生成失败，请稍后重试', 'error'); }
    setMmGenerating((p) => ({ ...p, [kind]: false }));
  };

  /* ── Dispatch to Agent Office ── */
  const handleDispatchToOffice = async (agentType: string, title: string) => {
    try {
      const skillName = decodeURIComponent(skill!);
      const res = await createAgentOfficeTask({
        agentType,
        title: `${title}: ${skillName}`,
        params: { skillName, level: 'beginner' },
        description: `从知识详情页派发，技能: ${skillName}`,
      });
      if (res.code === 200 && res.data?.id) {
        showToast(`已派发到智能体办公室，等待完成后自动刷新`);
        setPollingTaskId(res.data.id);
      }
    } catch { showToast('派发失败', 'error'); }
  };

  /* Trigger assess load when switching to assess tab */
  useEffect(() => {
    if (activeTab === 'assess' && !assessData && !assessLoading) {
      handleLoadAssess();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load multimodal resources when switching to multimodal tab */
  useEffect(() => {
    if (activeTab === 'multimodal' && !mmData && !mmLoading) {
      fetchMultimodal();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Poll dispatched agent office task */
  useEffect(() => {
    if (!pollingTaskId) return;
    const timer = setInterval(async () => {
      try {
        const res = await getAgentOfficeTask(pollingTaskId);
        const task = res.data;
        if (!task) return;
        if (task.taskStatus === 'success') {
          clearInterval(timer);
          setPollingTaskId(null);
          // 刷新页面内容
          const skillName = decodeURIComponent(skill!);
          const fresh = await getKnowledge(skillName);
          if (fresh.code === 200 && fresh.data) setData(fresh.data);
          showToast('智能体任务完成，内容已更新 ✨');
        } else if (task.taskStatus === 'failed') {
          clearInterval(timer);
          setPollingTaskId(null);
          showToast(`智能体任务失败: ${task.errorMessage || '未知错误'}`, 'error');
        }
      } catch { /* 网络错误继续重试 */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [pollingTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Completion logic ── */
  const allDone = readDone && quizSubmitted && (quizResult?.passed ?? false);

  /* Progress calculation (20% per tab) */
  const progressPct =
    (readDone ? 20 : 0) +
    (quizSubmitted && quizResult?.passed ? 20 : 0) +
    (codePracticed ? 20 : 0) +
    (readingDone ? 20 : 0) +
    (assessDone ? 20 : 0);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-loading">正在加载讲义...</div>
      </div>
    );
  }

  /* ─── Generating ─── */
  if (generating) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="3" strokeDasharray="6 4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="30 96" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
            <div style={{ font: '700 18px/1.4 var(--hand-bold)', color: 'var(--ink)', marginBottom: 8 }}>
              讲师正在为「{decodeURIComponent(skill || '')}」编写讲义...
            </div>
            <div style={{ font: '14px/1.5 var(--hand)', color: 'var(--pencil)', marginBottom: 20 }}>
              首次学习该技能，正在自动生成学习资料和练习题
            </div>
            <div style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', opacity: 0.5 }}>
              已等待 {pollCount * 3} 秒 / 预计 15-30 秒
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── No content ─── */
  if (!data?.has_content) {
    return (
      <div className="hd-page">
        <div className="hd-empty">
          <IconDocument size={40} className="mx-auto mb-3" style={{ color: 'var(--pencil)' }} />
          <p style={{ fontWeight: 700 }}>暂无内容</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>该技能的学习资料正在生成中</p>
          <button className="hd-btn secondary small" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
            返回
          </button>
        </div>
      </div>
    );
  }

  const quizCount = data.quiz?.length || 0;
  const codingCount = data.coding?.length || 0;

  /* ────────────────────────────────────────
     Markdown components override
     ──────────────────────────────────────── */
  const mdComponents = {
    h1: ({ children, ...props }: any) => (
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 800, marginTop: 24, marginBottom: 12 }} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 800, marginTop: 20, marginBottom: 8 }} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 style={{ fontFamily: 'var(--hand-bold)', fontSize: 17, marginTop: 16, marginBottom: 6 }} {...props}>{children}</h3>
    ),
    p: ({ children, ...props }: any) => (
      <p style={{ fontFamily: 'var(--hand)', fontSize: 15, lineHeight: 1.7, marginBottom: 10 }} {...props}>{children}</p>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      if (inline || (!className && typeof children === 'string' && !children.includes('\n'))) {
        return (
          <code
            style={{ background: 'var(--note-yellow)', fontFamily: 'var(--mono)', fontSize: 13, padding: '2px 6px', borderRadius: 4 }}
            {...props}
          >
            {children}
          </code>
        );
      }
      return <code className={className} {...props}>{children}</code>;
    },
    pre: ({ children, ...props }: any) => (
      <pre
        style={{ background: '#1e1e2e', borderRadius: 8, padding: 16, overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 13, color: '#cdd6f4' }}
        {...props}
      >
        {children}
      </pre>
    ),
    li: ({ children, ...props }: any) => (
      <li style={{ fontFamily: 'var(--hand)', fontSize: 15, marginBottom: 4 }} {...props}>{children}</li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, color: 'var(--pencil)', fontStyle: 'italic', margin: '12px 0' }}
        {...props}
      >
        {children}
      </blockquote>
    ),
    a: ({ children, ...props }: any) => (
      <a style={{ color: 'var(--accent)', textDecoration: 'underline' }} {...props}>{children}</a>
    ),
    table: ({ children, ...props }: any) => (
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--hand)', fontSize: 14, margin: '12px 0' }} {...props}>{children}</table>
    ),
    th: ({ children, ...props }: any) => (
      <th style={{ border: '1.5px solid var(--pencil)', padding: '8px 10px', background: 'var(--paper-tint)', fontFamily: 'var(--hand-bold)', textAlign: 'left' }} {...props}>{children}</th>
    ),
    td: ({ children, ...props }: any) => (
      <td style={{ border: '1.5px solid var(--rule)', padding: '8px 10px' }} {...props}>{children}</td>
    ),
  };

  return (
    <div className="hd-page">
      {/* Toast */}
      {msg && <div className={`hd-message ${msg.type}`}>{msg.text}</div>}

      <div className="hd-page-wrap">
        {/* ─── Header ─── */}
        <div className="hd-header">
          <div className="hd-flex">
            <button className="hd-btn secondary small" onClick={() => navigate(-1)}>
              <IconArrowLeft size={16} />
            </button>
            <h2>{decodeURIComponent(skill || '')}</h2>
            {masteryData && (
              <span className="hd-pill" style={{ marginLeft: 10, font: '700 14px/1 var(--hand-bold)' }}>
                掌握度 {masteryData.masteryPct}%
              </span>
            )}
          </div>
          {readDone && quizSubmitted && (
            <span className="hd-badge green">已完成</span>
          )}
        </div>

        {/* ─── Mastery breakdown ─── */}
        {masteryData && (
          <div className="hd-card" style={{ marginBottom: 12, padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(masteryData.breakdown).map(([key, item]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: item.done ? 'var(--note-green)' : 'var(--paper-tint)',
                    border: item.done ? '1px solid #a3d9a3' : '1px dashed var(--rule)',
                    font: '12px/1 var(--hand)',
                    color: item.done ? '#3a7d3a' : 'var(--pencil)',
                  }}
                >
                  {item.done ? <IconCheck size={12} /> : <div style={{ width: 12, height: 12, border: '1.5px solid var(--rule)', borderRadius: 3 }} />}
                  {item.label} +{item.weight}%
                </div>
              ))}
            </div>
            <div className="hd-progress" style={{ marginTop: 8 }}>
              <div
                className={`hd-progress-bar ${masteryData.masteryPct >= 100 ? 'green' : ''}`}
                style={{ width: `${masteryData.masteryPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ─── Legacy progress bar (fallback) ─── */}
        {!masteryData && (
          <div className="hd-progress" style={{ marginBottom: 20 }}>
            <div
              className={`hd-progress-bar ${progressPct >= 100 ? 'green' : ''}`}
              style={{ width: `${Math.max(progressPct, allDone ? 40 : 0)}%` }}
            />
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div className="hd-tabs">
          <button className={`hd-tab ${activeTab === 'lecture' ? 'active' : ''}`} onClick={() => setActiveTab('lecture')}>
            <IconBook size={16} /> 讲义
          </button>
          <button className={`hd-tab ${activeTab === 'quiz' ? 'active' : ''}`} onClick={() => setActiveTab('quiz')}>
            <IconDocument size={16} /> 测验
            {quizCount > 0 && <span className="hd-tab-num">{quizCount}</span>}
          </button>
          <button className={`hd-tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>
            <IconCode size={16} /> 代码
            {codingCount > 0 && <span className="hd-tab-num">{codingCount}</span>}
          </button>
          <button className={`hd-tab ${activeTab === 'reading' ? 'active' : ''}`} onClick={() => setActiveTab('reading')}>
            <IconBook size={16} /> 拓展
          </button>
          <button className={`hd-tab ${activeTab === 'assess' ? 'active' : ''}`} onClick={() => setActiveTab('assess')}>
            <IconChart size={16} /> 评估
          </button>
          <button className={`hd-tab ${activeTab === 'multimodal' ? 'active' : ''}`} onClick={() => setActiveTab('multimodal')}>
            <IconImage size={16} /> 多模态
          </button>
        </div>

        {/* ═══════════════════════════════════════
            Tab 1: 讲义 (Lecture)
            ═══════════════════════════════════════ */}
        {activeTab === 'lecture' && (
          <div className="hd-canvas" style={{ marginTop: 8 }}>
            <div style={{ fontFamily: 'var(--hand)', fontSize: 15, lineHeight: 1.7 }}>
              <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                {data.lecture || ''}
              </ReactMarkdown>
            </div>

            <div className="hd-divider" />

            {!readDone ? (
              <button className="hd-btn" onClick={handleMarkRead}>
                <IconCheck size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                标记为已读
              </button>
            ) : (
              <div className="hd-badge green" style={{ fontSize: 13 }}>
                <IconCheck size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                已完成阅读
              </div>
            )}

            {/* Continue learning button */}
            {readDone && (
              <div style={{ marginTop: 14 }}>
                <button
                  className="hd-btn secondary"
                  onClick={handleGenerateDeeper}
                  disabled={generatingDeeper}
                >
                  <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  {generatingDeeper ? '正在生成深入内容...' : '继续深入学习'}
                </button>
                <span style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--pencil)', marginLeft: 10 }}>
                  生成底层原理、高级用法、设计决策
                </span>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            Tab 2: 测验 (Quiz)
            ═══════════════════════════════════════ */}
        {activeTab === 'quiz' && (
          <div style={{ marginTop: 8 }}>
            {data.quiz?.map((q, i) => (
              <div key={i} className="hd-card-accent" style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 16, marginBottom: 14, color: 'var(--ink)' }}>
                  {i + 1}. {q.question}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map((opt, j) => {
                    const selected = quizAnswers[i] === j;
                    const isCorrect = quizSubmitted && j === q.answer;
                    const isWrong = quizSubmitted && selected && j !== q.answer;

                    let borderColor = 'var(--pencil)';
                    let bg = 'var(--paper)';
                    if (selected && !quizSubmitted) { borderColor = 'var(--accent)'; bg = 'var(--note-yellow)'; }
                    if (isCorrect) { borderColor = '#3a7d3a'; bg = 'var(--note-green)'; }
                    if (isWrong) { borderColor = 'var(--accent)'; bg = 'var(--note-pink)'; }

                    return (
                      <label
                        key={j}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          border: `2px solid ${borderColor}`,
                          borderRadius: 8,
                          background: bg,
                          cursor: quizSubmitted ? 'default' : 'pointer',
                          fontFamily: 'var(--hand)',
                          fontSize: 15,
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          checked={selected}
                          disabled={quizSubmitted}
                          onChange={() => setQuizAnswers({ ...quizAnswers, [i]: j })}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                        <span style={{ color: 'var(--ink)' }}>{opt}</span>
                        {isCorrect && <IconCheck size={16} style={{ marginLeft: 'auto', color: '#3a7d3a' }} />}
                        {isWrong && <IconX size={16} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                      </label>
                    );
                  })}
                </div>

                {quizSubmitted && (
                  <div className="hd-dashed" style={{ marginTop: 12, fontSize: 13, color: 'var(--pencil)' }}>
                    <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}

            {!quizSubmitted ? (
              <button
                className="hd-btn"
                style={{ width: '100%', marginTop: 4 }}
                onClick={handleQuizSubmit}
                disabled={Object.keys(quizAnswers).length < quizCount}
              >
                提交答案
              </button>
            ) : quizResult && (
              <div
                className="hd-card-accent"
                style={{
                  textAlign: 'center',
                  marginTop: 14,
                  background: quizResult.passed ? 'var(--note-green)' : 'var(--note-yellow)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 48,
                    fontWeight: 800,
                    color: quizResult.passed ? '#3a7d3a' : 'var(--accent)',
                  }}
                >
                  {quizResult.score}分
                </div>
                <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--pencil)', marginTop: 6 }}>
                  {quizResult.passed ? '恭喜通过！掌握度 +25%' : '未达到 70 分，建议复习后重试。'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            Tab 3: 代码 (Code)
            ═══════════════════════════════════════ */}
        {activeTab === 'code' && (
          <div style={{ marginTop: 8 }}>
            {data.coding && data.coding.length > 0 ? (
              data.coding.map((raw, i) => {
                const c = normalizeCodeExample(raw);
                const dc = difficultyColor(c.difficulty);
                const editorVal = codeEditors[i] ?? c.setup;
                const showSolution = codeSolutions[i];
                return (
                  <div key={i} className="hd-card-accent" style={{ marginBottom: 18 }}>
                    {/* Title + difficulty */}
                    <div className="hd-flex-between" style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 17, color: 'var(--ink)' }}>
                        练习 {i + 1}：{c.title}
                      </div>
                      <span
                        className="hd-badge"
                        style={{ color: dc.color, borderColor: dc.color, background: dc.bg }}
                      >
                        {difficultyLabel(c.difficulty)}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', marginBottom: 10 }}>
                      {c.description}
                    </p>

                    {/* Task */}
                    {c.task && (
                      <div style={{ background: 'var(--note-blue, #e8f0fe)', border: '1.5px solid #a0c4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                        <div style={{ font: '13px/1 var(--hand-bold)', color: '#1a56db', marginBottom: 6 }}>
                          任务
                        </div>
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
                          {c.task}
                        </div>
                      </div>
                    )}

                    {/* Code editor (setup code with TODO) */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.06em' }}>
                        {c.setup ? '代码（完成 TODO 部分）' : '自己动手写一写（可选）'}
                      </div>
                      <div style={{ border: '2px solid var(--pencil)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                        <CodeMirror
                          value={editorVal}
                          height="220px"
                          extensions={[javascript()]}
                          theme={oneDark}
                          onChange={(val) => setCodeEditors(prev => ({ ...prev, [i]: val }))}
                        />
                      </div>
                      {!c.setup && !codeEditors[i] && (
                        <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', marginBottom: 8 }}>
                          💡 点击下方「查看参考答案」查看完整代码，然后自己动手写一写
                        </div>
                      )}
                      <div className="hd-flex" style={{ marginBottom: 10 }}>
                        <button
                          className="hd-btn small"
                          onClick={() => {
                            handleRunCode(i, codeEditors[i] ?? c.setup);
                            setCodePracticed(true);
                          }}
                        >
                          运行
                        </button>
                        <button
                          className="hd-btn secondary small"
                          onClick={() => {
                            setCodeEditors(prev => ({ ...prev, [i]: c.setup }));
                            setCodeOutputs(prev => { const n = { ...prev }; delete n[i]; return n; });
                          }}
                        >
                          <IconRefresh size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                          重置
                        </button>
                        {c.hint && (
                          <button
                            className="hd-btn secondary small"
                            onClick={() => setCodeSolutions(prev => ({ ...prev, [i]: !prev[i] }))}
                          >
                            <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                            {showSolution ? '隐藏提示' : '查看提示'}
                          </button>
                        )}
                      </div>
                      {codeOutputs[i] !== undefined && (
                        <pre style={{ background: 'var(--paper-tint)', border: '1.5px solid var(--rule)', borderRadius: 8, padding: 14, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', margin: 0, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                          {codeOutputs[i]}
                        </pre>
                      )}
                    </div>

                    {/* Hint (collapsible) */}
                    {showSolution && c.hint && (
                      <div style={{ background: 'var(--note-yellow)', border: '1.5px dashed #c9a800', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                        <div style={{ font: '13px/1 var(--hand-bold)', color: '#8a6d00', marginBottom: 4 }}>提示</div>
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)' }}>{c.hint}</div>
                      </div>
                    )}

                    {/* Solution (collapsible) */}
                    <div>
                      <button
                        className="hd-btn secondary small"
                        onClick={() => {
                          const key = `sol_${i}`;
                          setCodeSolutions(prev => ({ ...prev, [key]: !prev[key] }));
                        }}
                        style={{ marginBottom: 8 }}
                      >
                        {codeSolutions[`sol_${i}`] ? '隐藏答案' : '查看参考答案'}
                      </button>
                      {codeSolutions[`sol_${i}`] && (
                        <div>
                          <pre style={{ background: '#1e1e2e', borderRadius: 8, padding: 16, overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 13, color: '#cdd6f4', margin: 0 }}>
                            <code>{c.solution}</code>
                          </pre>
                          {c.solutionExplanation && c.solutionExplanation.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6 }}>逐行解释</div>
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {c.solutionExplanation.map((exp, j) => (
                                  <li key={j} style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>{exp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {c.expectedOutput && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6 }}>预期输出</div>
                              <pre style={{ background: 'var(--paper-tint)', border: '1.5px solid var(--rule)', borderRadius: 8, padding: 14, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', margin: 0 }}>
                                {c.expectedOutput}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Common mistakes */}
                    {c.commonMistakes && c.commonMistakes.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6 }}>常见错误</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {c.commonMistakes.map((m, j) => (
                            <li key={j} style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--accent)', marginBottom: 4 }}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Key points */}
                    {c.keyPoints && c.keyPoints.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6 }}>要点</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {c.keyPoints.map((kp, j) => (
                            <span key={j} className="hd-tag">{kp}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="hd-empty">
                <IconCode size={36} style={{ margin: '0 auto 12px', color: 'var(--pencil)' }} />
                <p>暂无代码案例</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    className="hd-btn"
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                  >
                    {generatingCode ? '生成中...' : '⚡ 直接生成'}
                  </button>
                  <button
                    className="hd-btn secondary"
                    onClick={() => handleDispatchToOffice('code', '代码案例')}
                  >
                    🏢 派发到办公室
                  </button>
                </div>
              </div>
            )}

            {/* Code completion button */}
            {data.coding && data.coding.length > 0 && !codePracticed && (
              <div style={{ marginTop: 16 }}>
                <button className="hd-btn" style={{ width: '100%' }} onClick={handleMarkCodeComplete}>
                  <IconCheck size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                  标记编程实战完成 (+25% 掌握度)
                </button>
              </div>
            )}
            {codePracticed && (
              <div className="hd-badge green" style={{ fontSize: 13, marginTop: 12 }}>
                <IconCheck size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                编程实战已完成
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            Tab 4: 拓展 (Reading)
            ═══════════════════════════════════════ */}
        {activeTab === 'reading' && (
          <div style={{ marginTop: 8 }}>
            {/* Study advice sticky note */}
            {studyAdvice && (
              <div className="hd-note yellow" style={{ maxWidth: '100%', marginBottom: 16, transform: 'rotate(-1deg)' }}>
                <div className="hd-note-tape" />
                <b>学习建议</b>
                <div style={{ marginTop: 6 }}>{studyAdvice}</div>
              </div>
            )}

            {data.reading && data.reading.length > 0 ? (
              data.reading.map((r, i) => {
                const dc = difficultyColor(r.difficulty);
                const typeLabels: Record<string, string> = { why: '为什么', practice: '实战', deep: '深度', compare: '对比' };
                return (
                  <div key={i} className="hd-card-accent" style={{ marginBottom: 16 }}>
                    {/* Title */}
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
                      {r.title}
                    </div>

                    {/* Meta row */}
                    <div className="hd-flex" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      {r.type && (
                        <span className="hd-badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                          {typeLabels[r.type] || r.type}
                        </span>
                      )}
                      <span
                        className="hd-badge"
                        style={{ color: dc.color, borderColor: dc.color, background: dc.bg }}
                      >
                        {difficultyLabel(r.difficulty)}
                      </span>
                      {r.readTime && (
                        <span className="hd-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconClock size={12} /> {r.readTime}
                        </span>
                      )}
                    </div>

                    {/* Full article content */}
                    <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.8, marginBottom: 12 }}>
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                        {r.content || ''}
                      </ReactMarkdown>
                    </div>

                    {/* Key concepts */}
                    {r.keyConcepts && r.keyConcepts.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 6, letterSpacing: '0.06em' }}>
                          核心概念
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {r.keyConcepts.map((kc, j) => (
                            <span key={j} className="hd-tag">{kc}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Thinking questions (collapsible) */}
                    {r.questions && r.questions.length > 0 && (
                      <div>
                        <button
                          className="hd-btn secondary small"
                          onClick={() => setReadingExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                          style={{ marginBottom: readingExpanded[i] ? 8 : 0 }}
                        >
                          <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                          思考问题 {readingExpanded[i] ? '▲' : '▼'}
                        </button>
                        {readingExpanded[i] && (
                          <div className="hd-dashed" style={{ marginTop: 4 }}>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {r.questions.map((q, j) => (
                                <li key={j} style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mark reading done (on last item or always) */}
                    {i === (data.reading?.length ?? 0) - 1 && !readingDone && (
                      <div style={{ marginTop: 14 }}>
                        <button
                          className="hd-btn small"
                          onClick={() => {
                            setReadingDone(true);
                            showToast('拓展阅读已标记完成');
                          }}
                        >
                          <IconCheck size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                          标记阅读完成
                        </button>
                      </div>
                    )}
                    {readingDone && i === (data.reading?.length ?? 0) - 1 && (
                      <div className="hd-badge green" style={{ fontSize: 13, marginTop: 10 }}>
                        <IconCheck size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                        已完成拓展阅读
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="hd-empty">
                <IconBook size={36} style={{ margin: '0 auto 12px', color: 'var(--pencil)' }} />
                <p>暂无拓展阅读</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    className="hd-btn"
                    onClick={handleGenerateReading}
                    disabled={generatingReading}
                  >
                    {generatingReading ? '生成中...' : '⚡ 直接生成'}
                  </button>
                  <button
                    className="hd-btn secondary"
                    onClick={() => handleDispatchToOffice('reading', '拓展阅读')}
                  >
                    🏢 派发到办公室
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            Tab 5: 评估 (Assessment)
            ═══════════════════════════════════════ */}
        {activeTab === 'assess' && (
          <div style={{ marginTop: 8 }}>
            {assessLoading && (
              <div className="hd-loading">
                <svg width="36" height="36" viewBox="0 0 48 48" style={{ marginBottom: 12 }}>
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="3" strokeDasharray="6 4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="30 96" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <div>正在评估学习效果...</div>
              </div>
            )}

            {!assessLoading && !assessData && (
              <div className="hd-empty">
                <IconTarget size={36} style={{ margin: '0 auto 12px', color: 'var(--pencil)' }} />
                <p>点击按钮开始评估</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button className="hd-btn" onClick={handleLoadAssess}>
                    ⚡ 直接评估
                  </button>
                  <button
                    className="hd-btn secondary"
                    onClick={() => handleDispatchToOffice('assess', '学习评估')}
                  >
                    🏢 派发到办公室
                  </button>
                </div>
              </div>
            )}

            {assessData && (
              <>
                {/* Overall score */}
                <div
                  className="hd-card-accent"
                  style={{
                    textAlign: 'center',
                    marginBottom: 18,
                    background: assessData.overallScore >= 80 ? 'var(--note-green)' : assessData.overallScore >= 60 ? 'var(--note-yellow)' : 'var(--note-pink)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 48,
                      fontWeight: 800,
                      color: assessData.overallScore >= 80 ? '#3a7d3a' : assessData.overallScore >= 60 ? '#8a6d00' : 'var(--accent)',
                    }}
                  >
                    {assessData.overallScore}
                  </div>
                  <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--pencil)', marginTop: 4 }}>
                    综合评分
                  </div>
                  {assessData.level && (
                    <span className="hd-badge" style={{ marginTop: 8, color: 'var(--ink)', borderColor: 'var(--ink)' }}>
                      {assessData.level}
                    </span>
                  )}
                </div>

                {/* Radar chart */}
                {assessData.dimensions && assessData.dimensions.length > 0 && (
                  <div className="hd-card" style={{ marginBottom: 18 }}>
                    <div style={{ font: '14px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 14, letterSpacing: '0.06em', textAlign: 'center' }}>
                      能力维度分析
                    </div>
                    <RadarChart dimensions={assessData.dimensions} />

                    {/* Dimension details */}
                    <div style={{ marginTop: 16 }}>
                      {assessData.dimensions.map((d, i) => (
                        <div key={i} className="hd-flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--rule)' }}>
                          <div>
                            <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{d.dimension}</span>
                            <span style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--pencil)', marginLeft: 8 }}>
                              {d.detail}
                            </span>
                          </div>
                          <div className="hd-flex" style={{ gap: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--accent)' }}>
                              {d.score}/{d.maxScore}
                            </span>
                            {d.trend === 'up' && <span style={{ color: '#3a7d3a' }}>↑</span>}
                            {d.trend === 'down' && <span style={{ color: 'var(--accent)' }}>↓</span>}
                            {d.trend === 'stable' && <span style={{ color: 'var(--pencil)' }}>→</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weak points */}
                {assessData.weakPoints && assessData.weakPoints.length > 0 && (
                  <div className="hd-card-accent" style={{ marginBottom: 18 }}>
                    <div style={{ font: '15px/1 var(--hand-bold)', color: 'var(--ink)', marginBottom: 12 }}>
                      <IconWarning size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                      薄弱环节
                    </div>
                    {assessData.weakPoints.map((wp, i) => (
                      <div key={i} className="hd-dashed" style={{ marginBottom: 10 }}>
                        <div className="hd-flex-between" style={{ marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{wp.skill}</span>
                          <span
                            className="hd-badge"
                            style={{
                              color: wp.level === 'low' ? 'var(--accent)' : '#8a6d00',
                              borderColor: wp.level === 'low' ? 'var(--accent)' : '#8a6d00',
                              background: wp.level === 'low' ? 'var(--note-pink)' : 'var(--note-yellow)',
                            }}
                          >
                            {wp.level === 'low' ? '较弱' : '一般'}
                          </span>
                        </div>
                        <p style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', margin: '4px 0' }}>
                          {wp.description}
                        </p>
                        <p style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)', margin: 0 }}>
                          <IconLightbulb size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                          {wp.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {assessData.improvements && assessData.improvements.length > 0 && (
                  <div className="hd-card-accent" style={{ marginBottom: 18 }}>
                    <div style={{ font: '15px/1 var(--hand-bold)', color: 'var(--ink)', marginBottom: 12 }}>
                      <IconTarget size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                      改进建议
                    </div>
                    {assessData.improvements.map((imp, i) => {
                      const pColor = imp.priority === 'high' ? 'var(--accent)' : imp.priority === 'medium' ? '#8a6d00' : '#3a7d3a';
                      const pBg = imp.priority === 'high' ? 'var(--note-pink)' : imp.priority === 'medium' ? 'var(--note-yellow)' : 'var(--note-green)';
                      const pLabel = imp.priority === 'high' ? '高' : imp.priority === 'medium' ? '中' : '低';
                      return (
                        <div key={i} style={{ padding: '10px 0', borderBottom: '1px dashed var(--rule)' }}>
                          <div className="hd-flex-between" style={{ marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{imp.area}</span>
                            <span className="hd-badge" style={{ color: pColor, borderColor: pColor, background: pBg }}>
                              优先级: {pLabel}
                            </span>
                          </div>
                          <p style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', margin: '4px 0' }}>
                            {imp.action}
                          </p>
                          <p style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink)', margin: 0, fontStyle: 'italic' }}>
                            预期效果: {imp.expectedEffect}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Plan adjustment */}
                {assessData.planAdjustment && (
                  <div className="hd-dashed" style={{ marginBottom: 18, fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)' }}>
                    <div style={{ font: '14px/1 var(--mono)', color: 'var(--pencil)', marginBottom: 8, letterSpacing: '0.06em' }}>
                      计划调整建议
                    </div>
                    {assessData.planAdjustment}
                  </div>
                )}

                {/* Summary */}
                {assessData.summary && (
                  <div className="hd-card" style={{ marginBottom: 14, fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', lineHeight: 1.6 }}>
                    {assessData.summary}
                  </div>
                )}

                {/* Encouragement */}
                {assessData.encouragement && (
                  <div
                    className="hd-note green"
                    style={{ maxWidth: '100%', transform: 'rotate(-1deg)' }}
                  >
                    <div className="hd-note-tape" />
                    <b>加油</b>
                    <div style={{ marginTop: 6 }}>{assessData.encouragement}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            Tab 6: 多模态 (Multimodal)
            ═══════════════════════════════════════ */}
        {activeTab === 'multimodal' && (
          <div style={{ marginTop: 8 }}>
            {mmLoading ? (
              <div className="hd-loading">
                <svg width="36" height="36" viewBox="0 0 48 48" style={{ marginBottom: 12 }}>
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="3" strokeDasharray="6 4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="30 96" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <div>正在加载多模态资源...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* 动画演示 */}
                <MmSection
                  label="HTML 动画演示"
                  hint="可视化演示概念的执行过程"
                  has={!!mmData?.animation}
                  generating={!!mmGenerating.animation}
                  onGenerate={() => handleGenerateMm('animation')}
                >
                  {mmData?.animation && <AnimationCard data={mmData.animation} />}
                </MmSection>

                {/* 图表 */}
                <MmSection
                  label="Mermaid 图解"
                  hint="流程图 / 架构图 / 时序图"
                  has={!!mmData?.diagram}
                  generating={!!mmGenerating.diagram}
                  onGenerate={() => handleGenerateMm('diagram')}
                >
                  {mmData?.diagram && <DiagramCard data={mmData.diagram} />}
                </MmSection>

                {/* 短视频 */}
                <MmSection
                  label="教学短视频"
                  hint="智谱 AI 生成 5 秒可视化视频"
                  has={!!mmData?.video}
                  generating={!!mmGenerating.video}
                  onGenerate={() => handleGenerateMm('video')}
                >
                  {mmData?.video && <VideoCard data={mmData.video} />}
                </MmSection>

                {/* 数字人 */}
                <MmSection
                  label="数字人讲解"
                  hint="讯飞虚拟教师讲解"
                  has={!!mmData?.avatar}
                  generating={!!mmGenerating.avatar}
                  onGenerate={() => handleGenerateMm('avatar')}
                >
                  {mmData?.avatar && <AvatarCard data={mmData.avatar} />}
                </MmSection>
              </div>
            )}
          </div>
        )}

        {/* ─── Complete skill button ─── */}
        {allDone && (
          <>
            <div className="hd-divider" />
            <button
              className="hd-btn highlight"
              style={{ width: '100%' }}
              onClick={async () => {
                const skillName = decodeURIComponent(skill!);
                try {
                  await markComplete(skillName, 0).catch(() => {});
                  await updateSkillMastery(skillName, { masteryPct: 80 }).catch(() => {});
                  showToast('技能已标记为完成！匹配度即将更新...');
                } catch {
                  showToast('技能已标记为完成！');
                }
                setTimeout(() => navigate('/user/learning'), 1200);
              }}
            >
              <IconCheck size={18} style={{ marginRight: 8, verticalAlign: -3 }} />
              完成此技能
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Multimodal section wrapper — 标题 + 生成按钮 + 内容
   ────────────────────────────────────────── */
function MmSection({
  label,
  hint,
  has,
  generating,
  onGenerate,
  children,
}: {
  label: string;
  hint: string;
  has: boolean;
  generating: boolean;
  onGenerate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 16, color: 'var(--ink)' }}>{label}</div>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--pencil)' }}>{hint}</div>
        </div>
        <button className="hd-btn small" onClick={onGenerate} disabled={generating}>
          {generating ? '生成中...' : has ? '↻ 重新生成' : '⚡ 生成'}
        </button>
      </div>
      {has ? (
        children
      ) : (
        <div className="hd-dashed" style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--pencil)', fontFamily: 'var(--hand)', fontSize: 14 }}>
          {generating ? '正在生成，请稍候...' : '暂无内容，点击「生成」创建'}
        </div>
      )}
    </div>
  );
}
