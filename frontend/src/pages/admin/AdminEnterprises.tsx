import { useState, useEffect, useCallback } from 'react';
import { getAdminEnterprises, createAdminEnterprise, updateAdminEnterprise, deleteAdminEnterprise } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { type AdminColumn } from '../../components/admin/AdminTable';
import AdminModal from '../../components/admin/AdminModal';
import AdminPagination from '../../components/admin/AdminPagination';
import { IconPlus, IconRefresh, IconSearch, IconEdit, IconTrash } from '../../components/icons';

function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export default function AdminEnterprises() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', contactName: '', contactEmail: '', contactPhone: '', industry: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    try { const res = await getAdminEnterprises({ page: p, pageSize: 20 }); setData(res.data || []); setTotal(res.total || 0); }
    catch {} finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ name: '', contactName: '', contactEmail: '', contactPhone: '', industry: '', description: '' }); setModalOpen(true); };
  const openEdit = (row: any) => { setEditingId(row.id); setForm({ name: row.name || '', contactName: row.contactName || '', contactEmail: row.contactEmail || '', contactPhone: row.contactPhone || '', industry: row.industry || '', description: row.description || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { showToast('请填写企业名称', 'error'); return; }
    setSaving(true);
    try {
      if (editingId) { await updateAdminEnterprise({ id: editingId, ...form }); showToast('更新成功'); }
      else { await createAdminEnterprise(form); showToast('创建成功'); }
      setModalOpen(false); fetchData();
    } catch (e: any) { showToast(e?.message || '操作失败', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除？')) return;
    try { await deleteAdminEnterprise(id); showToast('已删除'); fetchData(); }
    catch (e: any) { showToast(e?.message || '删除失败', 'error'); }
  };

  const statusLabel: Record<number, { text: string; cls: string }> = { 0: { text: '待审核', cls: '' }, 1: { text: '已通过', cls: 'green' }, 2: { text: '已拒绝', cls: 'red' } };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'name', title: '企业名称', sortable: true },
    { key: 'industry', title: '行业', render: (v) => v || '-' },
    { key: 'contactName', title: '联系人', render: (v) => v || '-' },
    { key: 'contactEmail', title: '邮箱', render: (v) => v || '-' },
    { key: 'status', title: '状态', render: (v) => { const s = statusLabel[v] || statusLabel[0]; return <span className={`hd-badge ${s.cls}`}>{s.text}</span>; } },
    { key: 'actions', title: '操作', align: 'center', render: (_: any, row: any) => (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button className="hd-btn small secondary" title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(row); }}><IconEdit size={14} /></button>
        <button className="hd-btn small secondary" title="删除" style={{ color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}><IconTrash size={14} /></button>
      </div>
    ) },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="企业管理" subtitle={`共 ${total} 家企业`} actions={
        <><button className="hd-btn small secondary" onClick={() => fetchData()}><IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新</button>
        <button className="hd-btn small" onClick={openCreate}><IconPlus size={14} style={{ marginRight: 4 }} /> 添加企业</button></>
      } />

      <AdminTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />

      <AdminModal open={modalOpen} title={editingId ? '编辑企业' : '添加企业'} onClose={() => setModalOpen(false)} width={520}
        footer={<><button className="hd-btn small secondary" onClick={() => setModalOpen(false)}>取消</button><button className="hd-btn small" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="admin-form-group"><label className="admin-form-label">企业名称 *</label><input className="admin-form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">行业</label><input className="admin-form-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">联系人</label><input className="admin-form-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">联系电话</label><input className="admin-form-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
        </div>
        <div className="admin-form-group"><label className="admin-form-label">邮箱</label><input className="admin-form-input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
        <div className="admin-form-group"><label className="admin-form-label">简介</label><textarea className="admin-form-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </AdminModal>
    </div>
  );
}
