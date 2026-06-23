import { useState, useEffect, useCallback } from 'react';
import { getAdminQuestions, getAdminQuestionStats, reviewAdminQuestion, updateAdminQuestion } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { type AdminColumn } from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import { IconRefresh, IconFilter } from '../../components/icons';

/* ── Toast ──────────────────────────────────────────── */
function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ── Question type & status labels ─────────────────── */
const questionTypeLabel: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  coding: '编程题',
  essay: '简答题',
};

const statusLabelMap: Record<number, string> = {
  0: '待审核',
  1: '已上架',
  '-1': '已下架',
};

/* ── Component ─────────────────────────────────────── */
export default function AdminQuestions() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Filters
  const [skillName, setSkillName] = useState('');
  const [questionType, setQuestionType] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<number | undefined>(undefined);

  // Edit modal
  const [editItem, setEditItem] = useState<any | null>(null);

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize: 20 };
      if (skillName) params.skillName = skillName;
      if (questionType) params.questionType = questionType;
      if (difficulty !== undefined) params.difficulty = difficulty;
      if (status !== undefined) params.status = status;
      const res = await getAdminQuestions(params);
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, skillName, questionType, difficulty, status]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getAdminQuestionStats(skillName || undefined);
      setStats(res.data);
    } catch {}
  }, [skillName]);

  useEffect(() => { fetchData(); fetchStats(); }, []);

  const handleSearch = () => { setPage(1); fetchData(1); fetchStats(); };

  const handleReview = async (id: number, newStatus: number) => {
    try {
      await reviewAdminQuestion(id, newStatus);
      showToast(newStatus === 1 ? '已上架' : '已下架');
      fetchData();
      fetchStats();
    } catch { showToast('操作失败', 'error'); }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      await updateAdminQuestion(editItem.id, editItem);
      showToast('已更新');
      setEditItem(null);
      fetchData();
    } catch { showToast('更新失败', 'error'); }
  };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'skillName', title: '技能', render: (v) => v || '-' },
    {
      key: 'questionType',
      title: '题型',
      render: (v) => <span className="hd-badge accent">{questionTypeLabel[v] || v}</span>,
    },
    {
      key: 'questionText',
      title: '题目',
      render: (v) => {
        if (!v) return '-';
        return v.length > 50 ? v.slice(0, 50) + '...' : v;
      },
    },
    {
      key: 'difficulty',
      title: '难度',
      sortable: true,
      render: (v) => v ? <span className="hd-tag">Lv{v}</span> : '-',
    },
    {
      key: 'confidence',
      title: '置信度',
      render: (v) => v !== null && v !== undefined ? `${(v * 100).toFixed(0)}%` : '-',
    },
    {
      key: 'passRate',
      title: '通过率',
      render: (v) => v !== null && v !== undefined ? `${(v * 100).toFixed(0)}%` : '-',
    },
    {
      key: 'status',
      title: '状态',
      render: (v) => (
        <span className={`hd-badge ${v === 1 ? 'green' : v === -1 ? 'red' : ''}`}>
          {statusLabelMap[v] || v}
        </span>
      ),
    },
    {
      key: '_actions',
      title: '操作',
      width: 160,
      render: (_: any, record: any) => (
        <div className="hd-flex" style={{ gap: 6 }}>
          <button
            className="hd-btn small secondary"
            onClick={() => setEditItem({ ...record })}
          >
            编辑
          </button>
          {record.status !== 1 && (
            <button
              className="hd-btn small"
              onClick={() => handleReview(record.id, 1)}
            >
              上架
            </button>
          )}
          {record.status === 1 && (
            <button
              className="hd-btn small secondary"
              onClick={() => handleReview(record.id, -1)}
              style={{ color: 'var(--accent)' }}
            >
              下架
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader
        title="题库管理"
        subtitle={`共 ${total} 道题目`}
        actions={
          <button className="hd-btn small secondary" onClick={() => { fetchData(); fetchStats(); }}>
            <IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新
          </button>
        }
      />

      {/* ── Stats cards ─────────────────────────────── */}
      {stats && (
        <div className="hd-kpis" style={{ marginBottom: 16 }}>
          <div className="hd-kpi hd-tilt-1">
            <div className="hd-kpi-label">总题数</div>
            <div className="hd-kpi-value ink">{stats.total ?? total}</div>
          </div>
          {stats.byType && Object.entries(stats.byType as Record<string, number>).map(([t, count], i) => (
            <div key={t} className={`hd-kpi hd-tilt-${(i % 4) + 1}`}>
              <div className="hd-kpi-label">{questionTypeLabel[t] || t}</div>
              <div className="hd-kpi-value">{count as number}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────── */}
      <div className="admin-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          className="hd-input"
          placeholder="技能名称..."
          value={skillName}
          onChange={(e) => setSkillName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: 160 }}
        />
        <select
          className="hd-input"
          value={questionType ?? ''}
          onChange={(e) => setQuestionType(e.target.value || undefined)}
          style={{ width: 120 }}
        >
          <option value="">全部题型</option>
          <option value="choice">选择题</option>
          <option value="fill">填空题</option>
          <option value="coding">编程题</option>
          <option value="essay">简答题</option>
        </select>
        <select
          className="hd-input"
          value={difficulty ?? ''}
          onChange={(e) => setDifficulty(e.target.value ? Number(e.target.value) : undefined)}
          style={{ width: 120 }}
        >
          <option value="">全部难度</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>Lv{d}</option>
          ))}
        </select>
        <select
          className="hd-input"
          value={status ?? ''}
          onChange={(e) => setStatus(e.target.value !== '' ? Number(e.target.value) : undefined)}
          style={{ width: 120 }}
        >
          <option value="">全部状态</option>
          <option value={0}>待审核</option>
          <option value={1}>已上架</option>
          <option value={-1}>已下架</option>
        </select>
        <button className="hd-btn small" onClick={handleSearch}>
          <IconFilter size={14} style={{ marginRight: 4 }} /> 筛选
        </button>
      </div>

      {/* ── Table ───────────────────────────────────── */}
      <AdminTable columns={columns} data={data} loading={loading} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />

      {/* ── Edit modal ──────────────────────────────── */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(43,38,32,0.35)' }} onClick={() => setEditItem(null)} />
          <div className="hd-card" style={{ position: 'relative', zIndex: 301, width: 480, maxHeight: '80vh', overflow: 'auto', padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>编辑题目 #{editItem.id}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <span style={{ fontSize: 13, color: 'var(--pencil)', marginBottom: 4, display: 'block' }}>题目内容</span>
                <textarea
                  className="hd-input"
                  rows={4}
                  value={editItem.questionText || ''}
                  onChange={(e) => setEditItem({ ...editItem, questionText: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, color: 'var(--pencil)', marginBottom: 4, display: 'block' }}>难度</span>
                <select
                  className="hd-input"
                  value={editItem.difficulty || 1}
                  onChange={(e) => setEditItem({ ...editItem, difficulty: Number(e.target.value) })}
                  style={{ width: '100%' }}
                >
                  {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Lv{d}</option>)}
                </select>
              </label>
              <label>
                <span style={{ fontSize: 13, color: 'var(--pencil)', marginBottom: 4, display: 'block' }}>技能名称</span>
                <input
                  className="hd-input"
                  value={editItem.skillName || ''}
                  onChange={(e) => setEditItem({ ...editItem, skillName: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
            <div className="hd-flex" style={{ gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="hd-btn small secondary" onClick={() => setEditItem(null)}>取消</button>
              <button className="hd-btn small" onClick={handleSaveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
