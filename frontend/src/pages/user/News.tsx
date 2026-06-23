import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNews } from '../../api/user';
import type { NewsItem } from '../../types';
import '../../styles/hand-draw.css';
import {
  IconNewspaper,
  IconRefresh,
  IconClock,
} from '../../components/icons';

const typeLabels: Record<number, string> = {
  1: '行业动态',
  2: '技术趋势',
  3: '招聘信息',
};

export default function News() {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<number | undefined>(undefined);

  const fetchNews = async (type?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNews({ page: 1, pageSize: 50, type: type ? String(type) : undefined });
      setNews(res.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(activeType);
  }, [activeType]);

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
              技术动态、招聘信息、行业趋势
            </p>
          </div>
        </div>

        {/* Type filter tabs */}
        <div className="hd-tabs">
          <button
            className={`hd-tab ${activeType === undefined ? 'active' : ''}`}
            onClick={() => setActiveType(undefined)}
          >
            全部
          </button>
          {[1, 2, 3].map((t) => (
            <button
              key={t}
              className={`hd-tab ${activeType === t ? 'active' : ''}`}
              onClick={() => setActiveType(t)}
            >
              {typeLabels[t]}
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
                onClick={() => {
                  if (item.sourceUrl) {
                    window.open(item.sourceUrl, '_blank');
                  } else {
                    navigate(`/user/news/${item.id}`);
                  }
                }}
              >
                <div className="hd-flex-between" style={{ marginBottom: 8 }}>
                  <h3 style={{ font: '700 17px/1.3 var(--hand-bold)', color: 'var(--ink)', margin: 0, flex: 1, paddingRight: 12 }}>
                    {item.title}
                  </h3>
                  {item.type && (
                    <span className={`hd-badge ${item.type === 'tech' ? 'accent' : item.type === 'recruit' ? 'green' : ''}`}
                      style={{ flexShrink: 0 }}
                    >
                      {item.type === 'tech' ? '技术趋势' : item.type === 'recruit' ? '招聘信息' : '行业动态'}
                    </span>
                  )}
                </div>

                {item.content && (
                  <p style={{ font: '14px/1.5 var(--hand)', color: 'var(--pencil)', margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.content}
                  </p>
                )}

                <div className="hd-flex" style={{ gap: 14, font: '13px/1 var(--mono)', color: 'var(--pencil)' }}>
                  <span>{item.source}</span>
                  {item.publishTime && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconClock size={13} />
                      {new Date(Number(item.publishTime) * 1000).toLocaleDateString('zh-CN')}
                    </span>
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
