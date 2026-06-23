import { useState, useEffect, useCallback } from 'react';
import { getAdminSettings, getAdminHealth } from '../../api/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { IconRefresh, IconSettings } from '../../components/icons';

function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `hd-message ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export default function AdminSettings() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, healthRes] = await Promise.all([getAdminSettings(), getAdminHealth()]);
      setConfig(configRes.data || {});
      setHealth(healthRes.data || null);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const configLabels: Record<string, { label: string; desc: string }> = {
    site_name: { label: '站点名称', desc: '平台显示名称' },
    llm_model: { label: 'LLM 模型', desc: 'AI 助教使用的模型' },
    searxng_url: { label: 'SearXNG 地址', desc: '搜索引擎服务地址' },
    news_cron: { label: '资讯抓取周期', desc: '自动抓取新闻的 cron 表达式' },
  };

  if (loading) {
    return (
      <div className="hd-canvas">
        <AdminPageHeader title="系统设置" />
        <div className="admin-table-wrap" style={{ padding: 40, textAlign: 'center' }}>
          <div className="admin-skeleton" style={{ width: 200, height: 20, margin: '0 auto 12px' }} />
          <div className="admin-skeleton" style={{ width: 300, height: 20, margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="hd-canvas">
      <AdminPageHeader title="系统设置" subtitle="查看系统配置和健康状态" actions={
        <button className="hd-btn small secondary" onClick={fetchData}><IconRefresh size={14} style={{ marginRight: 4 }} /> 刷新</button>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 系统配置 */}
        <div className="admin-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--ink)', font: '700 14px/1 var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pencil)', background: 'var(--paper-tint)' }}>
            <IconSettings size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> 系统配置
          </div>
          {Object.entries(configLabels).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ font: '14px/1.4 var(--hand-bold)', color: 'var(--ink)' }}>{meta.label}</div>
                <div style={{ font: '12px/1.3 var(--hand)', color: 'var(--pencil)', marginTop: 2 }}>{meta.desc}</div>
              </div>
              <code style={{ font: '13px/1 var(--mono)', background: 'var(--paper-tint)', padding: '4px 10px', borderRadius: 4, color: 'var(--ink)', border: '1px solid var(--rule)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {config[key] || <span style={{ color: 'var(--pencil)' }}>未配置</span>}
              </code>
            </div>
          ))}
        </div>

        {/* 健康状态 */}
        <div className="admin-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--ink)', font: '700 14px/1 var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pencil)', background: 'var(--paper-tint)' }}>
            健康检查
          </div>
          {health && (
            <>
              {[
                { label: 'API 服务', value: health.status === 'ok' },
                { label: '服务版本', value: true, extra: health.version },
                { label: '服务名称', value: true, extra: health.service },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.value ? '#3a7d3a' : 'var(--accent)', marginRight: 10, flexShrink: 0 }} />
                  <span style={{ font: '14px/1.4 var(--hand)', flex: 1, color: 'var(--ink)' }}>{item.label}</span>
                  {item.extra ? (
                    <code style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)' }}>{item.extra}</code>
                  ) : (
                    <span className={`hd-badge ${item.value ? 'green' : 'red'}`}>{item.value ? '正常' : '异常'}</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
