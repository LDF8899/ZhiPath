import { useState, useEffect, useCallback } from 'react';
import { getAdminExams } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { type AdminColumn } from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import { IconRefresh } from '../../components/icons';

function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export default function AdminExams() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<number | undefined>(undefined);

  const fetchData = useCallback(async (p = page, passed = filter) => {
    setLoading(true);
    try { const res = await getAdminExams({ page: p, pageSize: 20, passed }); setData(res.data || []); setTotal(res.total || 0); }
    catch {} finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchData(); }, []);

  const examTypeLabel: Record<number, string> = { 1: '技能考试', 2: '岗位考试', 3: '速测' };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'userId', title: '用户ID' },
    { key: 'skillName', title: '技能', render: (v) => v || '-' },
    { key: 'examType', title: '考试类型', render: (v) => <span className="hd-badge accent">{examTypeLabel[v] || v}</span> },
    { key: 'score', title: '分数', sortable: true, render: (v) => v !== null && v !== undefined ? `${v}分` : '-' },
    { key: 'passed', title: '结果', render: (v) => <span className={`hd-badge ${v ? 'green' : 'red'}`}>{v ? '通过' : '未通过'}</span> },
    { key: 'createTime', title: '考试时间', sortable: true, render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
  ];

  const filterOptions = [
    { label: '全部', value: undefined },
    { label: '已通过', value: 1 },
    { label: '未通过', value: 0 },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="考试管理" subtitle={`共 ${total} 条考试记录`} actions={
        <button className="hd-btn small secondary" onClick={() => fetchData()}><IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新</button>
      } />

      <div className="admin-filter-bar">
        <div className="admin-filter-tabs">
          {filterOptions.map((opt) => (
            <button key={String(opt.value)} className={`admin-filter-tab ${filter === opt.value ? 'active' : ''}`}
              onClick={() => { setFilter(opt.value); setPage(1); fetchData(1, opt.value); }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTable columns={columns} data={data} loading={loading} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />
    </div>
  );
}
