import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNews, refreshNews } from '../../api/user';
import type { NewsItem } from '../../types';
import '../../styles/hand-draw.css';
import {
  IconNewspaper,
  IconRefresh,
  IconClock,
  IconExternalLink,
} from '../../components/icons';

const typeLabels: Record<string, string> = {
  industry: '行业动态',
  tech: '技术趋势',
  recruit: '招聘信息',
};

const typeOptions: Array<{ value?: 'industry' | 'tech' | 'recruit'; label: string }> = [
  { value: undefined, label: '全部' },
  { value: 'industry', label: '行业动态' },
  { value: 'tech', label: '技术趋势' },
  { value: 'recruit', label: '招聘信息' },
];

export default function News() {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'industry' | 'tech' | 'recruit' | undefined>(undefined);
  const [refreshInfo, setRefreshInfo] = useState<string>('');

  const fetchNews = async (type?: 'industry' | 'tech' | 'recruit') => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNews({ page: 1, pageSize: 50, type });
      setNews(res.data || []);
      if (res.meta?.autoRefreshed && res.meta?.refreshStats) {
        setRefreshInfo(`已自动抓取 ${res.meta.refreshStats.inserted || 0} 条 AI 资讯`);
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(activeType);
  }, [activeType]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await refreshNews();
      const inserted = res.data?.inserted ?? res.data?.refreshed ?? 0;
      const skipped = res.data?.skipped ?? 0;
      setRefreshInfo(`已抓取 ${inserted} 条，去重跳过 ${skipped} 条`);
      await fetchNews(activeType);
    } catch (err: any) {
      setError(err?.message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-loading">
              <IconNewspaper size={32} />
              <div style={{ marginTop: 8 }}>正在加载资讯...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-empty">
              <div style={{ marginBottom: 12 }}>{error}</div>
              <button className="hd-btn small" onClick={() => fetchNews(activeType)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconRefresh size={16} /> 重试
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* Header */}
        <div className="hd-header">
          <div>
            <h1>行业资讯</h1>
            <p style={{ font: '15px/1.3 var(--hand)', color: 'var(--pencil)', margin: '4px 0 0' }}>
              AI 领域新闻自动抓取、摘要和技术标签
            </p>
          </div>
          <button className="hd-btn small secondary" onClick={handleRefresh} disabled={refreshing}>
            <IconRefresh size={14} style={{ marginRight: 6 }} />
            {refreshing ? '抓取中...' : '刷新 AI 资讯'}
          </button>
        </div>
        {refreshInfo && (
          <div className="hd-pill" style={{ marginBottom: 12 }}>
            {refreshInfo}
          </div>
        )}

        {/* Type filter tabs */}
        <div className="hd-tabs">
          {typeOptions.map((t) => (
            <button
              key={t.value || 'all'}
              className={`hd-tab ${activeType === t.value ? 'active' : ''}`}
              onClick={() => setActiveType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* News list */}
        {news.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {news.map((item) => (
              <div
                key={item.id}
                className="hd-card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/user/news/${item.id}`)}
              >
                <div className="hd-flex-between" style={{ marginBottom: 8 }}>
                  <h3 style={{ font: '700 17px/1.3 var(--hand-bold)', color: 'var(--ink)', margin: 0, flex: 1, paddingRight: 12 }}>
                    {item.title}
                  </h3>
                  {item.type && (
                    <span className={`hd-badge ${item.type === 'tech' ? 'accent' : item.type === 'recruit' ? 'green' : ''}`}
                      style={{ flexShrink: 0 }}
                    >
                      {typeLabels[item.type] || '行业动态'}
                    </span>
                  )}
                </div>

                {(item.summary || item.content) && (
                  <p style={{ font: '14px/1.5 var(--hand)', color: 'var(--pencil)', margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.summary || item.content}
                  </p>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {item.tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="hd-tag">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="hd-flex" style={{ gap: 14, font: '13px/1 var(--mono)', color: 'var(--pencil)' }}>
                  <span>{item.source}</span>
                  {item.publishTime && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconClock size={13} />
                      {new Date(Number(item.publishTime)).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                  {item.sourceUrl && (
                    <button
                      className="hd-link"
                      style={{ border: 0, background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <IconExternalLink size={13} />
                      原文
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hd-canvas">
            <div className="hd-empty">
              <IconNewspaper size={48} />
              <div style={{ marginTop: 12 }}>暂无资讯</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
