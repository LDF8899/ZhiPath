import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestionGenerator } from '../../hooks/useQuestionGenerator';
import { questionBankImportApi } from '../../api/bankImport';
import { questionBankApi } from '../../api/questionBank';
import { remediationApi } from '../../api/remediation';
import GeoGebraFigure from '../../components/GeoGebraFigure';
import FigureRenderer from '../../components/FigureRenderer';
import { takePendingQuestionConfig } from '../../utils/questionGeneratorConfig';
import '../../styles/hand-draw.css';

const TYPE_LABELS: Record<string, string> = { choice: '单选', fill: '填空', coding: '编程', essay: '简答' };
const TYPE_ORDER = ['choice', 'fill', 'coding', 'essay'];
const DIFFICULTY_PRESETS = [
  { key: 'easy', label: '基础', value: 3, hint: '单步 / 记忆' },
  { key: 'medium', label: '进阶', value: 6, hint: '两步以上推理' },
  { key: 'hard', label: '挑战', value: 9, hint: '多步综合 / 压轴' },
];

export default function QuestionGenerator() {
  const navigate = useNavigate();
  const pendingConfig = takePendingQuestionConfig();
  const generator = useQuestionGenerator(pendingConfig || { subject: '', count: 5, difficulty: 5, questionTypes: ['choice'] });
  const [selected, setSelected] = useState<number[]>([]);
  const [draftsSaved, setDraftsSaved] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const selectedQuestions = useMemo(() => generator.questions.filter((_, index) => selected.includes(index)), [generator.questions, selected]);
  const approvableIds = selectedQuestions.map((question: any) => Number(question.id)).filter(Boolean);
  const updateConfig = (patch: any) => generator.setConfig((current) => ({ ...current, ...patch }));
  const activePreset = generator.config.difficulty <= 3 ? 'easy' : generator.config.difficulty <= 6 ? 'medium' : 'hard';
  const addTopic = () => {
    const label = topicInput.trim();
    if (!label) return;
    const topics = Array.isArray(generator.config.topics) ? generator.config.topics : [];
    if (topics.some((topic: any) => String(topic.label || topic.id) === label)) { setTopicInput(''); return; }
    updateConfig({ topics: [...topics, { label }] });
    setTopicInput('');
  };
  const importImages = (files: FileList | null) => setImportFiles(Array.from(files || []).filter((f) => f.type.startsWith('image/')) || []);
  const runImport = async () => {
    if (!importFiles.length) return;
    setImportBusy(true); setImportResult(null); setSelectedCandidates([]);
    try {
      const images = await Promise.all(importFiles.map((file) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      })));
      const res = await questionBankImportApi.import({ filename: importFiles[0]?.name || '上传图片', fileType: 'image', images });
      setImportResult(res.data);
      if (res.data?.candidates?.length) setSelectedCandidates(res.data.candidates.map((c: any) => Number(c.candidateId)));
    } catch (e: any) {
      setImportResult({ status: 'error', errorMessage: e?.message || '识别失败' });
    } finally { setImportBusy(false); }
  };
  const confirmImport = async () => {
    if (!importResult?.id || !selectedCandidates.length) return;
    setImportBusy(true);
    try {
      await questionBankImportApi.confirm(Number(importResult.id), selectedCandidates);
      setImportResult((prev: any) => ({ ...prev, status: 'imported' }));
    } catch (e: any) { alert(`入库失败：${e?.message || ''}`); }
    finally { setImportBusy(false); }
  };
  const [remedyBusy, setRemedyBusy] = useState(false);
  const [weakPoints, setWeakPoints] = useState<Array<{ label: string; masteryPct: number }>>([]);
  const runRemediation = async () => {
    setRemedyBusy(true);
    try {
      const res = await remediationApi.prepare({ count: generator.config.count, difficulty: generator.config.difficulty, questionTypes: generator.config.questionTypes });
      const data = res.data;
      setWeakPoints(data.weakPoints || []);
      if (data.config) await generator.start(data.config);
    } catch (e: any) { alert(`补弱分析失败：${e?.message || ''}`); }
    finally { setRemedyBusy(false); }
  };

  // 批准后自动组卷并立即开始练习（闭环：审核 → 入库 → 作答）
  const [approveBusy, setApproveBusy] = useState(false);
  const approveAndTake = async (ids: number[]) => {
    if (!ids.length) return;
    setApproveBusy(true);
    try {
      const res = await generator.approve(ids);
      const approvedIds = res?.questionIds?.length ? res.questionIds : ids;
      if (approvedIds.length) {
        const asm = await questionBankApi.assemble(approvedIds);
        const examId = asm.data?.examId;
        if (examId) navigate(`/user/exams/${examId}/take`);
        else alert('已批准并入库，可在「题库/组卷」中组卷作答。');
      }
    } catch (e: any) { alert(`批准失败：${e?.message || ''}`); }
    finally { setApproveBusy(false); }
  };

  // 支持通过 ?taskId= 从错题本/聊天进入时，自动加载该出题任务的快照（用于审核）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('taskId');
    if (taskId) {
      generator.refresh(Number(taskId)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hd-page"><div className="hd-page-wrap" style={{ maxWidth: 920 }}>
      <div className="hd-header"><div><h1>通用出题器</h1><p style={{ color: 'var(--pencil)' }}>配置、生成、审核，再将题目发布到题库。</p></div><span className="hd-badge">{generator.status}</span></div>
      <section className="hd-card-accent" style={{ marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <label>主题 / 技能<input className="hd-input" value={generator.config.subject} onChange={(event) => updateConfig({ subject: event.target.value })} placeholder="例如 React Hooks、财务报表分析" /></label>
          <label>题数<input className="hd-input" type="number" min={1} max={100} value={generator.config.count} onChange={(event) => updateConfig({ count: Math.min(100, Math.max(1, Number(event.target.value)) || 1) })} /></label>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="hd-flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--pencil)' }}>难度（当前 {generator.config.difficulty}/10）</span>
            <span style={{ fontSize: 12, color: 'var(--pencil)' }}>{DIFFICULTY_PRESETS.find((p) => p.key === activePreset)?.hint}</span>
          </div>
          <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            {DIFFICULTY_PRESETS.map((preset) => (
              <button key={preset.key} className={`hd-btn secondary small${activePreset === preset.key ? ' active' : ''}`} onClick={() => updateConfig({ difficulty: preset.value })}>{preset.label}</button>
            ))}
            <input className="hd-input" style={{ width: 80 }} type="number" min={1} max={10} value={generator.config.difficulty} onChange={(event) => updateConfig({ difficulty: Math.min(10, Math.max(1, Number(event.target.value) || 1)) })} title="精确难度 1-10" />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--pencil)' }}>题型</span>
            {TYPE_ORDER.map((type) => (
              <button key={type} type="button" className={`hd-btn secondary small${generator.config.questionTypes.includes(type) ? ' active' : ''}`} onClick={() => updateConfig({ questionTypes: generator.config.questionTypes.includes(type) ? generator.config.questionTypes.filter((item) => item !== type) : [...generator.config.questionTypes, type] })}>{TYPE_LABELS[type]}</button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--pencil)' }}>已选 {generator.config.questionTypes.length} 种（可多选）</span>
          </div>
        </div>

        <label style={{ display: 'block', marginTop: 14 }}>知识点（可选，聚焦特定考点）<div className="hd-flex" style={{ gap: 8, marginTop: 6 }}><input className="hd-input" value={topicInput} onChange={(event) => setTopicInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTopic(); } }} placeholder="例如 useEffect 依赖、闭包" /><button className="hd-btn secondary small" onClick={addTopic} type="button">添加</button></div>
          {(generator.config.topics?.length || 0) > 0 && <div className="hd-flex" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{(generator.config.topics || []).map((topic: any, index: number) => <span key={index} className="hd-badge" style={{ cursor: 'pointer' }} onClick={() => updateConfig({ topics: (generator.config.topics || []).filter((_: any, i: number) => i !== index) })}>{topic.label || topic.id} ×</span>)}</div>}
        </label>

        <label style={{ display: 'block', marginTop: 14 }}>定制要求（可选）<textarea className="hd-input" rows={2} value={generator.config.instructions || ''} onChange={(event) => updateConfig({ instructions: event.target.value })} placeholder="例如：结合实际案例、避免重复、偏应用场景" /></label>

        <div className="hd-flex" style={{ gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={`hd-btn secondary small${generator.config.referenceLibrary ? ' active' : ''}`} onClick={() => updateConfig({ referenceLibrary: !generator.config.referenceLibrary })}>结合题库（防重复）</button>
          <span style={{ fontSize: 12, color: 'var(--pencil)' }}>参考已入库题目出题，避免与题库近似重复</span>
        </div>

        <div className="hd-flex" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="hd-btn secondary small" onClick={runRemediation} disabled={generator.busy || remedyBusy}>{remedyBusy ? '补弱分析中...' : '智能补弱出题'}</button>
          <button className="hd-btn small" onClick={() => generator.start()} disabled={generator.busy}>{generator.busy ? '生成中...' : '开始生成'}</button>
        </div>
        {weakPoints.length > 0 && <div className="hd-note" style={{ marginTop: 12 }}>已定位到弱项：{weakPoints.map((w) => `${w.label}(${Math.round(w.masteryPct)}%)`).join('、')}，将按「由浅入深」补弱出题并参考题库防重复。</div>}

        {generator.error && <div className="hd-note pink" style={{ marginTop: 12 }}>{generator.error}</div>}
        {(generator.status === 'starting' || generator.status === 'running') && <div style={{ marginTop: 16 }}>
          <div className="hd-flex-between" style={{ fontSize: 12, color: 'var(--pencil)', marginBottom: 6 }}>
            <span>{generator.status === 'starting' ? '正在启动后台生成...' : `正在生成 第 ${Math.min(generator.progress.current + 1, generator.progress.total || 1)} / ${generator.progress.total || '…'} 题`}{generator.progress.message ? ` · ${generator.progress.message}` : ''}</span>
            <span>{generator.progress.current}/{generator.progress.total || '…'}</span>
          </div>
          <div className="hd-progress"><div className="hd-progress-bar" style={{ width: `${Math.min(100, ((generator.progress.current || 0) / (generator.progress.total || 1)) * 100)}%` }} /></div>
        </div>}
      </section>
      {generator.questions.length > 0 && <section style={{ marginTop: 24 }}><div className="hd-flex-between"><div className="hd-section-label"><h3>审核题目</h3></div><div className="hd-flex" style={{ gap: 8 }}><button className="hd-btn secondary small" onClick={() => { setDraftsSaved(false); generator.saveDrafts().then(() => setDraftsSaved(true)); }} disabled={generator.busy}>{draftsSaved ? '草稿已保存' : '保存草稿'}</button><button className="hd-btn small" onClick={() => approveAndTake(approvableIds)} disabled={!approvableIds.length || generator.busy || approveBusy}>{approveBusy ? '处理中...' : '批准并练习'}</button></div></div>
        <div className="hd-flex-col" style={{ gap: 10, marginTop: 12 }}>{generator.questions.map((question: any, index: number) => <article key={question.clientId || index} className="hd-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><input type="checkbox" checked={selected.includes(index)} onChange={() => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} /><div style={{ flex: 1 }}><div className="hd-flex" style={{ gap: 8, marginBottom: 6 }}><span className="hd-badge">{TYPE_LABELS[question.type] || question.type}</span><span style={{ color: 'var(--pencil)', fontSize: 12 }}>第 {index + 1} 题</span></div><div style={{ fontWeight: 700 }}>{question.stem}</div>{question.figure ? <FigureRenderer figure={question.figure} /> : null}{question.options?.length > 0 && <ol style={{ margin: '8px 0 0 20px', color: 'var(--pencil)' }}>{question.options.map((option: any) => <li key={option.key}>{option.text}</li>)}</ol>}<div style={{ marginTop: 8, color: 'var(--pencil)', fontSize: 13 }}>{question.solution}</div></div></article>)}</div></section>}

      <section className="hd-card" style={{ marginTop: 24 }}>
        <div className="hd-section-label"><h3>题库导入（OCR 识别试卷图片）</h3></div>
        <p style={{ fontSize: 13, color: 'var(--pencil)', marginTop: 6 }}>上传试卷/题库图片，自动识别题目，审核后发布到题库，用于「结合题库出题」。</p>
        <div className="hd-flex" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" accept="image/*" multiple onChange={(e) => importImages(e.target.files)} />
          <button className="hd-btn small" onClick={runImport} disabled={importBusy || !importFiles.length}>{importBusy ? '识别中...' : '开始识别'}</button>
          {importResult?.status === 'imported' && <span className="hd-badge">已发布 {importResult.importedCount || 0} 题</span>}
        </div>
        {importResult?.errorMessage && <div className="hd-note pink" style={{ marginTop: 10 }}>{importResult.errorMessage}</div>}
        {importResult?.candidates?.length > 0 && <div className="hd-flex-col" style={{ gap: 8, marginTop: 12 }}>
          <div className="hd-flex-between"><span style={{ fontSize: 12, color: 'var(--pencil)' }}>识别到 {importResult.candidates.length} 道题，勾选后入库</span><button className="hd-btn secondary small" onClick={confirmImport} disabled={importBusy || !selectedCandidates.length}>确认入库</button></div>
          {importResult.candidates.map((candidate: any) => <label key={candidate.candidateId} className="hd-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" checked={selectedCandidates.includes(Number(candidate.candidateId))} onChange={() => setSelectedCandidates((current) => current.includes(Number(candidate.candidateId)) ? current.filter((item) => item !== Number(candidate.candidateId)) : [...current, Number(candidate.candidateId)])} /><div style={{ flex: 1 }}><div className="hd-flex" style={{ gap: 6, marginBottom: 4 }}><span className="hd-badge">{TYPE_LABELS[candidate.questionType] || candidate.questionType}</span><span style={{ color: 'var(--pencil)', fontSize: 12 }}>难度 {candidate.difficulty}</span>{candidate.needsReview ? <span className="hd-badge" style={{ background: 'var(--warning, #f59e0b)' }}>需复核</span> : null}</div><div style={{ fontWeight: 600 }}>{candidate.stem}</div>{candidate.options?.length > 0 && <ol style={{ margin: '6px 0 0 20px', color: 'var(--pencil)', fontSize: 13 }}>{candidate.options.map((option: string, i: number) => <li key={i}>{option}</li>)}</ol>}{candidate.explanation && <div style={{ marginTop: 6, color: 'var(--pencil)', fontSize: 13 }}>{candidate.explanation}</div>}</div></label>)}
        </div>}
      </section>
    </div></div>
  );
}
