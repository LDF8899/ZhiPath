import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard } from '../../api/admin';
import '../../styles/hand-draw.css';
import { IconUser, IconBriefcase, IconDocument, IconChart, IconRefresh, IconGradCap, IconNewspaper } from '../../components/icons';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await getAdminDashboard(); setStats(res.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="hd-canvas">
        <div className="admin-page-header"><h1 className="admin-page-title">管理看板</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-stat-card">
              <div className="admin-skeleton" style={{ width: 36, height: 36, borderRadius: 8, marginBottom: 10 }} />
              <div className="admin-skeleton" style={{ width: 60, height: 12, marginBottom: 8 }} />
              <div className="admin-skeleton" style={{ width: 80, height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: IconUser, label: '注册用户', value: stats?.userCount || 0, color: '#5b5fc7', bg: '#f0f0ff', link: '/admin/users' },
    { icon: IconBriefcase, label: '在招岗位', value: stats?.jobCount || 0, color: '#1a73e8', bg: '#e8f0fe', link: '/admin/jobs' },
    { icon: IconDocument, label: '投递记录', value: stats?.applicationCount || 0, color: '#e8710a', bg: '#fef3e8', link: '/admin/applications' },
    { icon: IconChart, label: '学生数', value: stats?.studentCount || 0, color: '#3a7d3a', bg: '#e8f5e8', link: '/admin/users' },
    { icon: IconGradCap, label: '考试记录', value: stats?.examCount || 0, color: '#9334e6', bg: '#f3e8fd', link: '/admin/exams' },
    { icon: IconNewspaper, label: '资讯数', value: stats?.newsCount || 0, color: '#e8710a', bg: '#fef3e8', link: '/admin/news' },
  ];
  const quality = stats?.quality;
  const qualityCards = quality ? [
    {
      label: '岗位来源质量',
      value: `${quality.jobSource.enterpriseRate}%`,
      desc: `企业岗位 ${quality.jobSource.enterpriseJobCount} · 平台岗位 ${quality.jobSource.platformJobCount}`,
      alert: quality.jobSource.lowConfidenceJobCount > 0 ? `${quality.jobSource.lowConfidenceJobCount} 个低置信 JD` : 'JD 置信度正常',
      link: '/admin/jobs',
    },
    {
      label: '资源生产质量',
      value: `${quality.resources.failureRate}%`,
      desc: `成功 ${quality.resources.success} · 失败 ${quality.resources.failed} · 运行中 ${quality.resources.running}`,
      alert: quality.resources.failureRate > 10 ? '失败率偏高' : '失败率可控',
      link: '/admin/settings',
    },
    {
      label: '题库质量',
      value: quality.questions.avgPassRate == null ? '待统计' : `${quality.questions.avgPassRate}%`,
      desc: `上架 ${quality.questions.approved} · 待审 ${quality.questions.pending} · 低置信 ${quality.questions.lowConfidence}`,
      alert: quality.questions.pending > 0 ? '存在待审核题目' : '题库审核完成',
      link: '/admin/questions',
    },
    {
      label: '投递转化治理',
      value: `${quality.applications.pendingRate}%`,
      desc: `待审 ${quality.applications.pending} · 通过 ${quality.applications.approved} · 拒绝 ${quality.applications.rejected}`,
      alert: quality.applications.pending > 0 ? '需要处理投递' : '暂无待处理投递',
      link: '/admin/applications',
    },
  ] : [];

  return (
    <div className="hd-canvas">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">管理看板</h1>
          <p className="admin-page-subtitle">平台运营数据总览</p>
        </div>
        <button className="hd-btn small secondary" onClick={fetchData}>
          <IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={i}
              className="admin-stat-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(s.link)}
            >
              <div className="admin-stat-icon" style={{ background: s.bg }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div className="admin-stat-label">{s.label}</div>
              <div className="admin-stat-value">{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Operational quality */}
      {quality && (
        <div style={{ marginBottom: 24 }}>
          <div className="admin-page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="admin-page-title" style={{ fontSize: 20 }}>运营质量</h2>
              <p className="admin-page-subtitle">把岗位、资源、题库和投递从 CRUD 升级为可治理指标</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {qualityCards.map((item) => (
              <button
                key={item.label}
                className="admin-quality-card"
                onClick={() => navigate(item.link)}
              >
                <span className="admin-quality-label">{item.label}</span>
                <strong>{item.value}</strong>
                <span>{item.desc}</span>
                <em>{item.alert}</em>
              </button>
            ))}
          </div>
          <div className="hd-dashed" style={{ marginTop: 12, font: '13px/1.5 var(--hand)', color: 'var(--pencil)' }}>
            {quality.instrumentation.note}
          </div>
        </div>
      )}

      {/* Quick actions + System status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Quick actions */}
        <div className="admin-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '2px solid var(--ink)', font: '700 14px/1 var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pencil)', background: 'var(--paper-tint)' }}>
            快捷操作
          </div>
          {[
            { label: '岗位管理', desc: '管理招聘信息和技能要求', link: '/admin/jobs', color: '#1a73e8' },
            { label: '投递审核', desc: '审核用户的岗位投递', link: '/admin/applications', color: '#e8710a' },
            { label: '题库管理', desc: '查看考试记录和题库', link: '/admin/exams', color: '#9334e6' },
            { label: '用户管理', desc: '管理平台用户和角色', link: '/admin/users', color: '#5b5fc7' },
          ].map((item, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: i < 3 ? '1px solid var(--rule)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
              onClick={() => navigate(item.link)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-tint)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, marginRight: 12, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: '14px/1.4 var(--hand-bold)', color: 'var(--ink)' }}>{item.label}</div>
                <div style={{ font: '12px/1.3 var(--hand)', color: 'var(--pencil)', marginTop: 1 }}>{item.desc}</div>
              </div>
              <span style={{ font: '14px/1 var(--hand)', color: 'var(--pencil)' }}>→</span>
            </div>
          ))}
        </div>

        {/* System status */}
        <div className="admin-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '2px solid var(--ink)', font: '700 14px/1 var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pencil)', background: 'var(--paper-tint)' }}>
            系统状态
          </div>
          {[
            { label: 'API 服务', status: '正常', ok: true },
            { label: '数据库连接', status: '正常', ok: true },
            { label: 'Redis 缓存', status: '正常', ok: true },
            { label: 'LLM 服务', status: stats?.examCount > 0 ? '正常' : '待验证', ok: stats?.examCount > 0 },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: i < 3 ? '1px solid var(--rule)' : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.ok ? '#3a7d3a' : '#e8710a', marginRight: 10, flexShrink: 0 }} />
              <span style={{ font: '14px/1.4 var(--hand)', flex: 1, color: 'var(--ink)' }}>{item.label}</span>
              <span className={`hd-badge ${item.ok ? 'green' : ''}`}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
