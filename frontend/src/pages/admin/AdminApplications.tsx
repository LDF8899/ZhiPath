import { useState, useEffect, useCallback } from 'react';
import { getAdminApplications, reviewApplication } from '../../api/admin';
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

export default function AdminApplications() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<number | undefined>(undefined);

  const fetchData = useCallback(async (p = page, dec = filter) => {
    setLoading(true);
    try {
      const res = await getAdminApplications({ page: p, pageSize: 20, admin_decision: dec });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchData(); }, []);

  const handleReview = async (id: number, decision: number) => {
    try {
      await reviewApplication({ id, admin_decision: decision, admin_comment: decision === 1 ? '审核通过' : '审核拒绝' });
      showToast(decision === 1 ? '已通过' : '已拒绝');
      fetchData();
    } catch (e: any) { showToast(e?.message || '操作失败', 'error'); }
  };

  const decisionLabel: Record<number, { text: string; cls: string }> = {
    0: { text: '待处理', cls: '' },
    1: { text: '已通过', cls: 'green' },
    2: { text: '已拒绝', cls: 'red' },
  };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'userId', title: '用户ID' },
    { key: 'jobId', title: '岗位ID' },
    {
      key: 'adminDecision', title: '状态',
      render: (v) => {
        const d = decisionLabel[v] || decisionLabel[0];
        return <span className={`hd-badge ${d.cls}`}>{d.text}</span>;
      },
    },
    { key: 'adminComment', title: '审核意见', render: (v) => v || '-' },
    {
      key: 'createTime', title: '投递时间', sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (_: any, row: any) => (
        row.adminDecision === 0 ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button className="hd-btn small" style={{ background: '#3a7d3a', color: '#fff' }} onClick={(e) => { e.stopPropagation(); handleReview(row.id, 1); }}>通过</button>
            <button className="hd-btn small" style={{ background: 'var(--accent)', color: '#fff' }} onClick={(e) => { e.stopPropagation(); handleReview(row.id, 2); }}>拒绝</button>
          </div>
        ) : <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>已处理</span>
      ),
    },
  ];

  const filterOptions = [
    { label: '全部', value: undefined },
    { label: '待处理', value: 0 },
    { label: '已通过', value: 1 },
    { label: '已拒绝', value: 2 },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="投递审核" subtitle={`共 ${total} 条投递`} actions={
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
