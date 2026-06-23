import { useState, useEffect, useCallback } from 'react';
import { getAdminNews, createAdminNews, updateAdminNews, deleteAdminNews } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { type AdminColumn } from '../../components/admin/AdminTable';
import AdminModal from '../../components/admin/AdminModal';
import AdminPagination from '../../components/admin/AdminPagination';
import { IconPlus, IconRefresh, IconEdit, IconTrash } from '../../components/icons';

function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export default function AdminNews() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', type: 'article', source: '', url: '', summary: '', content: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (p = page, t = typeFilter) => {
    setLoading(true);
    try { const res = await getAdminNews({ page: p, pageSize: 20, type: t }); setData(res.data || []); setTotal(res.total || 0); }
    catch {} finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ title: '', type: 'article', source: '', url: '', summary: '', content: '' }); setModalOpen(true); };
  const openEdit = (row: any) => { setEditingId(row.id); setForm({ title: row.title || '', type: row.type || 'article', source: row.source || '', url: row.url || '', summary: row.summary || '', content: row.content || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.title) { showToast('请填写标题', 'error'); return; }
    setSaving(true);
    try {
      if (editingId) { await updateAdminNews({ id: editingId, ...form }); showToast('更新成功'); }
      else { await createAdminNews(form); showToast('创建成功'); }
      setModalOpen(false); fetchData();
    } catch (e: any) { showToast(e?.message || '操作失败', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除？')) return;
    try { await deleteAdminNews(id); showToast('已删除'); fetchData(); }
    catch (e: any) { showToast(e?.message || '删除失败', 'error'); }
  };

  const typeLabel: Record<string, string> = { article: '文章', news: '资讯', tutorial: '教程', announcement: '公告' };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'title', title: '标题', sortable: true },
    { key: 'type', title: '类型', render: (v) => <span className="hd-badge accent">{typeLabel[v] || v}</span> },
    { key: 'source', title: '来源', render: (v) => v || '-' },
    { key: 'publishTime', title: '发布时间', sortable: true, render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
    { key: 'actions', title: '操作', align: 'center', render: (_: any, row: any) => (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button className="hd-btn small secondary" title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(row); }}><IconEdit size={14} /></button>
        <button className="hd-btn small secondary" title="删除" style={{ color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}><IconTrash size={14} /></button>
      </div>
    ) },
  ];

  const filterOptions = [
    { label: '全部', value: undefined },
    { label: '文章', value: 'article' },
    { label: '资讯', value: 'news' },
    { label: '教程', value: 'tutorial' },
    { label: '公告', value: 'announcement' },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="资讯管理" subtitle={`共 ${total} 条资讯`} actions={
        <><button className="hd-btn small secondary" onClick={() => fetchData()}><IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新</button>
        <button className="hd-btn small" onClick={openCreate}><IconPlus size={14} style={{ marginRight: 4 }} /> 添加资讯</button></>
      } />

      <div className="admin-filter-bar">
        <div className="admin-filter-tabs">
          {filterOptions.map((opt) => (
            <button key={String(opt.value)} className={`admin-filter-tab ${typeFilter === opt.value ? 'active' : ''}`}
              onClick={() => { setTypeFilter(opt.value); setPage(1); fetchData(1, opt.value); }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />

      <AdminModal open={modalOpen} title={editingId ? '编辑资讯' : '添加资讯'} onClose={() => setModalOpen(false)} width={560}
        footer={<><button className="hd-btn small secondary" onClick={() => setModalOpen(false)}>取消</button><button className="hd-btn small" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button></>}>
        <div className="admin-form-group"><label className="admin-form-label">标题 *</label><input className="admin-form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="admin-form-group"><label className="admin-form-label">类型</label>
            <select className="admin-form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="article">文章</option><option value="news">资讯</option><option value="tutorial">教程</option><option value="announcement">公告</option>
            </select>
          </div>
          <div className="admin-form-group"><label className="admin-form-label">来源</label><input className="admin-form-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
        </div>
        <div className="admin-form-group"><label className="admin-form-label">链接</label><input className="admin-form-input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
        <div className="admin-form-group"><label className="admin-form-label">摘要</label><textarea className="admin-form-input" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        <div className="admin-form-group"><label className="admin-form-label">内容</label><textarea className="admin-form-input" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
      </AdminModal>
    </div>
  );
}
