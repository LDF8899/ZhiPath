import { useState } from 'react';
import { ChevronDown, FileSearch, Quote, ShieldAlert } from 'lucide-react';

export type EvidenceItem = {
  title?: string;
  source?: string;
  snippet?: string;
  content?: string;
  score?: number;
  url?: string;
  [key: string]: any;
};

/**
 * 证据链展示 —— "可信生成"落到界面上就是两块：
 *   1. 这段话依据了什么（引用列表，可展开看原文片段）
 *   2. 有没有没命中引用的（citationMiss，明确标出来而不是悄悄放过）
 */
export function EvidencePanel({
  items,
  citationMiss,
  defaultOpen = false,
}: {
  items: EvidenceItem[];
  citationMiss?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if ((!items || items.length === 0) && !citationMiss) return null;

  return (
    <div className="evidence">
      <button
        type="button"
        className="evidence__head"
        style={{ width: '100%', cursor: 'pointer' }}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Quote size={13} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          生成依据 · {items?.length || 0} 条知识库片段
        </span>
        {citationMiss && (
          <span className="tag tag--amber">
            <ShieldAlert size={10} />
            部分内容未命中引用
          </span>
        )}
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 200ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div className="evidence__list">
          {citationMiss && (
            <div className="evidence__item" style={{ background: 'var(--amber-100)' }}>
              <ShieldAlert size={14} style={{ color: 'var(--amber-600)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ color: 'var(--amber-600)' }}>未命中引用校验</strong>
                <p className="evidence__snippet" style={{ marginTop: 2 }}>
                  本次回复中有部分内容没有对应到知识库片段，已标记。建议对关键结论做二次确认，或让它基于你的学习资料重新生成。
                </p>
              </div>
            </div>
          )}

          {(items || []).map((item, index) => (
            <article key={index} className="evidence__item">
              <span className="evidence__index">{index + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                  <strong className="small strong truncate">
                    {item.title || item.source || '知识库片段'}
                  </strong>
                  {typeof item.score === 'number' && (
                    <span className="tag tag--outline" style={{ padding: '0 6px', fontSize: 10 }}>
                      相关度 {(item.score * (item.score <= 1 ? 100 : 1)).toFixed(0)}
                    </span>
                  )}
                </div>
                {item.url && /^https?:/i.test(item.url) && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tiny truncate"
                    style={{ color: 'var(--brand-600)', display: 'block', marginTop: 1 }}
                  >
                    {item.url}
                  </a>
                )}
                <p className="evidence__snippet" style={{ marginTop: 3 }}>
                  {(item.snippet || item.content || '').slice(0, 240)}
                  {(item.snippet || item.content || '').length > 240 ? '…' : ''}
                </p>
              </div>
            </article>
          ))}

          {(items || []).length === 0 && !citationMiss && (
            <div className="evidence__item">
              <FileSearch size={14} style={{ marginTop: 2 }} />
              <span className="evidence__snippet">本次回复未附带知识库引用。</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
