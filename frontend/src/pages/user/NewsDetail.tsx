import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getNewsDetail } from '../../api/user';
import type { NewsItem } from '../../types';
import '../../styles/hand-draw.css';
import {
  IconArrowLeft,
  IconClock,
  IconExternalLink,
  IconNewspaper,
} from '../../components/icons';

const typeBadgeClass: Record<string, string> = {
  tech: 'hd-badge accent',
  recruit: 'hd-badge green',
  industry: 'hd-badge',
};

const typeLabelMap: Record<string, string> = {
  tech: '技术趋势',
  recruit: '招聘信息',
  industry: '行业动态',
};

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getNewsDetail(Number(id))
      .then((res) => setNews(res.data))
      .catch((err) => setError(err?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

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
  if (error || !news) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-empty">
              <div style={{ marginBottom: 12 }}>{error || '资讯不存在'}</div>
              <button className="hd-btn small" onClick={() => navigate('/user/news')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconArrowLeft size={16} /> 返回列表
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
      <div className="hd-page-wrap" style={{ maxWidth: 800 }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/user/news')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            font: '15px/1 var(--hand)', color: 'var(--pencil)',
            background: 'none', border: 'none', cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <IconArrowLeft size={18} /> 返回资讯
        </button>

        {/* Article */}
        <div className="hd-canvas">
          <h1 style={{ font: '800 28px/1.2 var(--serif)', margin: '0 0 16px', color: 'var(--ink)' }}>
            {news.title}
          </h1>

          <div className="hd-flex" style={{ gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            {news.type && (
              <span className={typeBadgeClass[news.type] || 'hd-badge'}>
                {typeLabelMap[news.type] || '其他'}
              </span>
            )}
            <span style={{ font: '14px/1 var(--hand)', color: 'var(--pencil)' }}>{news.source}</span>
            <span style={{ font: '14px/1 var(--hand)', color: 'var(--pencil)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconClock size={14} />
              {new Date(news.publishTime).toLocaleDateString('zh-CN')}
            </span>
          </div>

          <div className="hd-divider" />

          {/* Content */}
          <div style={{ font: '16px/1.8 var(--hand)', color: 'var(--ink)', marginTop: 20 }}>
            {news.content || '资讯内容加载中...'}
          </div>

          {/* Source link */}
          {news.sourceUrl && (
            <div style={{ marginTop: 24 }}>
              <a
                href={news.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hd-link"
                style={{ font: '15px/1 var(--hand)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconExternalLink size={16} /> 查看原文
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
