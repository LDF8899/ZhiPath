import { Fragment, type ReactNode, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * 轻量 Markdown 渲染器
 *
 * 讲义正文和 AI 回复都是 Markdown。这里自己解析而不引入 react-markdown，
 * 输出 React 元素而不是 dangerouslySetInnerHTML —— 后端内容由 Agent 生成，
 * 直接注入 HTML 风险不可控。
 *
 * 支持：标题、段落、有序/无序列表、任务列表、行内代码、代码块、引用、
 * 表格、分割线、加粗、斜体、删除线、链接。
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter((part) => part !== '');
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      nodes.push(<s key={key}>{part.slice(2, -2)}</s>);
    } else if (/^\*[^*\n]+\*$/.test(part)) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (/^\[[^\]]+\]\([^)]+\)$/.test(part)) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const href = match[2];
        const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
        nodes.push(
          <a key={key} href={safe} target="_blank" rel="noreferrer noopener">
            {match[1]}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={key}>{part}</Fragment>);
      }
    } else {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });

  return nodes;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板不可用时静默失败
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {language && (
        <span
          className="mono"
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 10.5,
            color: '#7b839a',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {language}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="复制代码"
        style={{
          position: 'absolute',
          top: 7,
          right: 7,
          display: 'grid',
          placeItems: 'center',
          width: 26,
          height: 26,
          borderRadius: 6,
          color: copied ? '#5eead4' : '#9aa2b8',
          background: 'rgba(255,255,255,0.07)',
          transition: 'background 120ms',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const text = String(source ?? '');
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];

  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      index += 1;
      continue;
    }

    // 代码块
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || undefined;
      const buffer: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1; // 跳过收尾的 ```
      blocks.push(<CodeBlock key={`cb-${key++}`} code={buffer.join('\n')} language={language} />);
      continue;
    }

    // 标题
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const content = renderInline(heading[2], `h-${key}`);
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level - 1];
      blocks.push(<Tag key={`h-${key++}`}>{content}</Tag>);
      index += 1;
      continue;
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${key++}`} />);
      index += 1;
      continue;
    }

    // 表格
    if (trimmed.startsWith('|') && index + 1 < lines.length && /^\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1].trim())) {
      const header = parseTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[index].trim()));
        index += 1;
      }
      blocks.push(
        <table key={`tb-${key++}`}>
          <thead>
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={cellIndex}>{renderInline(cell, `th-${key}-${cellIndex}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell, `td-${key}-${rowIndex}-${cellIndex}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // 引用
    if (trimmed.startsWith('>')) {
      const buffer: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        buffer.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(<blockquote key={`bq-${key++}`}>{renderInline(buffer.join(' '), `bq-${key}`)}</blockquote>);
      continue;
    }

    // 任务列表
    if (/^[-*]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const items: Array<{ done: boolean; text: string }> = [];
      while (index < lines.length && /^[-*]\s+\[[ xX]\]\s+/.test(lines[index].trim())) {
        const matched = lines[index].trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (matched) items.push({ done: matched[1].toLowerCase() === 'x', text: matched[2] });
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} style={{ listStyle: 'none', paddingLeft: 2 }}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span
                aria-hidden
                style={{
                  marginTop: 6,
                  width: 13,
                  height: 13,
                  flexShrink: 0,
                  borderRadius: 3,
                  border: '1.5px solid var(--border-strong)',
                  background: item.done ? 'var(--green-600)' : 'transparent',
                  borderColor: item.done ? 'var(--green-600)' : undefined,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 9,
                  lineHeight: 1,
                }}
              >
                {item.done ? '✓' : ''}
              </span>
              <span>{renderInline(item.text, `tl-${key}-${itemIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `li-${key}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // 有序列表
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `oi-${key}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // 段落：连续非空且不是块级起点的行合并为一段
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|\||(-{3,}|\*{3,}|_{3,})$)/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) {
      blocks.push(<p key={`p-${key++}`}>{renderInline(paragraph.join(' '), `pp-${key}`)}</p>);
    } else {
      index += 1;
    }
  }

  return <div className={`prose ${className}`}>{blocks}</div>;
}
