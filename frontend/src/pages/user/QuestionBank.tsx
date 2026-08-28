import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionBankApi, type BankQuestion } from '../../api/questionBank';
import '../../styles/hand-draw.css';

const TYPE_LABELS: Record<string, string> = { choice: '单选', fill: '填空', coding: '编程', essay: '简答' };
const SOURCE_LABELS: Record<string, string> = { generated: 'AI 生成', imported: 'OCR 导入', manual: '手动', enterprise: '企业' };
const PAGE_SIZE = 20;

export default function QuestionBank() {
  const navigate = useNavigate();
  const [skillName, setSkillName] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [assembleBusy, setAssembleBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    questionBankApi.list({ skillName: skillName || undefined, questionType: questionType || undefined, difficulty: difficulty || undefined, source: source || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => { setList(res.data || []); setTotal(res.total || 0); setSelected([]); })
      .finally(() => setLoading(false));
  }, [skillName, questionType, difficulty, source, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedIds = useMemo(() => selected, [selected]);

  const assemble = async () => {
    if (!selectedIds.length) return;
    setAssembleBusy(true);
    try {
      const res = await questionBankApi.assemble(selectedIds);
      const examId = res.data?.examId;
      alert(`已组卷 ${res.data?.questionCount || selectedIds.length} 题。`);
      if (examId) navigate(`/user/exams/${examId}/take`);
    } catch (e: any) { alert(`组卷失败：${e?.message || ''}`); }
    finally { setAssembleBusy(false); }
  };

  return (
    <div className="hd-page"><div className="hd-page-wrap" style={{ maxWidth: 1000 }}>
      <div className="hd-header"><div><h1>题库 / 组卷</h1><p style={{ color: 'var(--pencil)' }}>浏览历史题目，勾选不同来源的题目组卷，无需每次重新生成。</p></div></div>
      <section className="hd-card-accent" style={{ marginTop: 20 }}>
        <div className="hd-flex" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="hd-input" style={{ flex: 1, minWidth: 180 }} value={skillName} onChange={(e) => { setSkillName(e.target.value); setPage(1); }} placeholder="按技能/主题筛选" />
          <select className="hd-input" value={questionType} onChange={(e) => { setQuestionType(e.target.value); setPage(1); }}><option value="">全部题型</option>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="hd-input" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}><option value="">全部难度</option>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} 星</option>)}</select>
          <select className="hd-input" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}><option value="">全部来源</option>{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <span style={{ fontSize: 12, color: 'var(--pencil)' }}>共 {total} 题，已选 {selectedIds.length} 题</span>
        </div>
        <div className="hd-flex" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="hd-btn small" onClick={assemble} disabled={!selectedIds.length || assembleBusy}>{assembleBusy ? '组卷中...' : '组卷并开始'}</button>
          <button className="hd-btn secondary small" onClick={() => navigate('/user/question-generator')}>去出题</button>
          <button className="hd-btn secondary small" onClick={() => navigate('/user/wrong-answers')}>错题本</button>
          <span style={{ fontSize: 12, color: 'var(--pencil)' }}>提示：错题本/弱项可到「出题器」做智能补弱</span>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="hd-flex-col" style={{ gap: 8 }}>
          {loading && <div className="hd-note" style={{ textAlign: 'center' }}>加载中...</div>}
          {!loading && list.length === 0 && <div className="hd-note" style={{ textAlign: 'center' }}>暂无题目，先去出题或导入试卷。</div>}
          {list.map((q) => (
            <label key={q.id} className="hd-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected((cur) => cur.includes(q.id) ? cur.filter((id) => id !== q.id) : [...cur, q.id])} />
              <div style={{ flex: 1 }}>
                <div className="hd-flex" style={{ gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="hd-badge">{TYPE_LABELS[q.type] || q.type}</span>
                  <span style={{ color: 'var(--pencil)', fontSize: 12 }}>难度 {q.difficulty}</span>
                  <span className="hd-badge">{SOURCE_LABELS[q.source] || q.source}</span>
                  {q.skillName && <span style={{ color: 'var(--pencil)', fontSize: 12 }}>{q.skillName}</span>}
                </div>
                <div style={{ fontWeight: 600 }}>{q.title}</div>
                {q.options?.length > 0 && <ol style={{ margin: '6px 0 0 20px', color: 'var(--pencil)', fontSize: 13 }}>{q.options.map((o, i) => <li key={i}>{o}</li>)}</ol>}
              </div>
            </label>
          ))}
        </div>
        <div className="hd-flex" style={{ gap: 10, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
          <button className="hd-btn secondary small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span style={{ fontSize: 12, color: 'var(--pencil)' }}>{page} / {totalPages}</span>
          <button className="hd-btn secondary small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </section>
    </div></div>
  );
}
