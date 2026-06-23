import { useState, useEffect, useCallback } from 'react';
import { getAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob } from '../../api/admin';
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

export default function AdminJobs() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', company: '', location: '', salaryRange: '', level: 'junior', requiredSkills: '', preferredSkills: '', jdText: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await getAdminJobs({ page: p, pageSize: 20, keyword: kw || undefined });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, keyword]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', company: '', location: '', salaryRange: '', level: 'junior', requiredSkills: '', preferredSkills: '', jdText: '' });
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '', company: row.company || '', location: row.location || '',
      salaryRange: row.salaryRange || '', level: row.level || 'junior',
      requiredSkills: JSON.stringify(row.requiredSkills || []),
      preferredSkills: JSON.stringify(row.preferredSkills || []),
      jdText: row.jdText || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { showToast('请填写岗位名称', 'error'); return; }
    setSaving(true);
    try {
      let reqSkills: any, prefSkills: any;
      try { reqSkills = JSON.parse(form.requiredSkills || '[]'); } catch { reqSkills = []; }
      try { prefSkills = JSON.parse(form.preferredSkills || '[]'); } catch { prefSkills = []; }
      const payload: any = { ...form, requiredSkills: reqSkills, preferredSkills: prefSkills };
      if (editingId) { payload.id = editingId; await updateAdminJob(payload); showToast('更新成功'); }
      else { await createAdminJob(payload); showToast('创建成功'); }
      setModalOpen(false);
      fetchData();
    } catch (e: any) { showToast(e?.message || '操作失败', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除该岗位？')) return;
    try { await deleteAdminJob(id); showToast('已删除'); fetchData(); }
    catch (e: any) { showToast(e?.message || '删除失败', 'error'); }
  };

  const levelLabel: Record<string, string> = { junior: '初级', mid: '中级', senior: '高级' };
  const skillsDisplay = (skills: any[]) => {
    if (!Array.isArray(skills) || skills.length === 0) return '-';
    return skills.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.name).join('、') + (skills.length > 3 ? ` +${skills.length - 3}` : '');
  };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'title', title: '岗位名称', sortable: true },
    { key: 'company', title: '公司', render: (v) => v || '-' },
    { key: 'level', title: '级别', render: (v) => <span className="hd-badge accent">{levelLabel[v] || v}</span> },
    { key: 'requiredSkills', title: '必须技能', render: (v) => skillsDisplay(v) },
    { key: 'location', title: '地点', render: (v) => v || '-' },
    { key: 'salaryRange', title: '薪资', render: (v) => v || '-' },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (_: any, row: any) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button className="hd-btn small secondary" title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(row); }}><IconEdit size={14} /></button>
          <button className="hd-btn small secondary" title="删除" style={{ color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}><IconTrash size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="岗位管理" subtitle={`共 ${total} 个岗位`} actions={
        <>
          <button className="hd-btn small secondary" onClick={() => fetchData()}><IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新</button>
          <button className="hd-btn small" onClick={openCreate}><IconPlus size={14} style={{ marginRight: 4 }} /> 添加岗位</button>
        </>
      } />

      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <input className="hd-input" placeholder="搜索岗位名称..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchData(1, keyword))} />
          <IconSearch size={16} className="admin-search-icon" />
        </div>
        <button className="hd-btn small" onClick={() => { setPage(1); fetchData(1, keyword); }}>搜索</button>
      </div>

      <AdminTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />

      <AdminModal open={modalOpen} title={editingId ? '编辑岗位' : '添加岗位'} onClose={() => setModalOpen(false)} width={560}
        footer={<><button className="hd-btn small secondary" onClick={() => setModalOpen(false)}>取消</button><button className="hd-btn small" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="admin-form-group"><label className="admin-form-label">岗位名称 *</label><input className="admin-form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">公司</label><input className="admin-form-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">工作地点</label><input className="admin-form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="admin-form-group"><label className="admin-form-label">薪资范围</label><input className="admin-form-input" value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} placeholder="如 15k-25k" /></div>
          <div className="admin-form-group"><label className="admin-form-label">级别</label>
            <select className="admin-form-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="junior">初级</option><option value="mid">中级</option><option value="senior">高级</option>
            </select>
          </div>
        </div>
        <div className="admin-form-group"><label className="admin-form-label">必须技能 (JSON)</label><textarea className="admin-form-input" rows={3} value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} placeholder='[{"name":"JavaScript","weight":0.9}]' /></div>
        <div className="admin-form-group"><label className="admin-form-label">加分技能 (JSON)</label><textarea className="admin-form-input" rows={2} value={form.preferredSkills} onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })} /></div>
        <div className="admin-form-group"><label className="admin-form-label">JD 原文</label><textarea className="admin-form-input" rows={3} value={form.jdText} onChange={(e) => setForm({ ...form, jdText: e.target.value })} /></div>
      </AdminModal>
    </div>
  );
}
