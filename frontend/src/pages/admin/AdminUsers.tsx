import { useState, useEffect, useCallback } from 'react';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../api/admin';
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

export default function AdminUsers() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ username: '', realName: '', password: '', role: 'student' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await getAdminUsers({ page: p, pageSize: 20, keyword: kw || undefined });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, keyword]);

  useEffect(() => { fetchData(); }, []);

  const handleSearch = () => { setPage(1); fetchData(1, keyword); };

  const openCreate = () => {
    setEditingId(null);
    setForm({ username: '', realName: '', password: '', role: 'student' });
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({ username: row.username, realName: row.realName || '', password: '', role: row.role || 'student' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingId && (!form.username || !form.password)) {
      showToast('请填写用户名和密码', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (editingId) {
        payload.id = editingId;
        if (!payload.password) delete payload.password;
        await updateAdminUser(payload);
        showToast('更新成功');
      } else {
        await createAdminUser(payload);
        showToast('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '操作失败', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除该用户？')) return;
    try {
      await deleteAdminUser(id);
      showToast('已删除');
      fetchData();
    } catch (e: any) { showToast(e?.message || '删除失败', 'error'); }
  };

  const columns: AdminColumn[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'username', title: '用户名', sortable: true },
    { key: 'realName', title: '姓名', render: (v) => v || '-' },
    {
      key: 'role', title: '角色', sortable: true,
      render: (v) => (
        <span className={`hd-badge${v === 'admin' ? ' red' : ' accent'}`}>
          {v === 'admin' ? '管理员' : '学生'}
        </span>
      ),
    },
    {
      key: 'status', title: '状态',
      render: (v) => (
        <span className={`hd-badge${v === 1 ? ' green' : ' red'}`}>
          {v === 1 ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'createTime', title: '注册时间', sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (_: any, row: any) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button className="hd-btn small secondary" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <IconEdit size={14} />
          </button>
          <button className="hd-btn small secondary" style={{ color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
            <IconTrash size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="hd-canvas">
      <AdminPageHeader
        title="用户管理"
        subtitle={`共 ${total} 个用户`}
        actions={
          <>
            <button className="hd-btn small secondary" onClick={() => fetchData()}>
              <IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新
            </button>
            <button className="hd-btn small" onClick={openCreate}>
              <IconPlus size={14} style={{ marginRight: 4 }} /> 添加用户
            </button>
          </>
        }
      />

      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <input
            className="hd-input"
            placeholder="搜索用户名或姓名..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <IconSearch size={16} className="admin-search-icon" />
        </div>
        <button className="hd-btn small" onClick={handleSearch}>搜索</button>
      </div>

      <AdminTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      <AdminPagination page={page} total={total} onChange={(p) => { setPage(p); fetchData(p); }} />

      <AdminModal
        open={modalOpen}
        title={editingId ? '编辑用户' : '添加用户'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="hd-btn small secondary" onClick={() => setModalOpen(false)}>取消</button>
            <button className="hd-btn small" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="admin-form-group">
          <label className="admin-form-label">用户名 *</label>
          <input className="admin-form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editingId} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">姓名</label>
          <input className="admin-form-input" value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">密码 {editingId ? '(留空不修改)' : '*'}</label>
          <input className="admin-form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? '留空则不修改' : ''} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">角色</label>
          <select className="admin-form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="student">学生</option>
            <option value="admin">管理员</option>
          </select>
        </div>
      </AdminModal>
    </div>
  );
}
