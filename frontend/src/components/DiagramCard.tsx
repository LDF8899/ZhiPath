import { useEffect, useRef, useState } from 'react';
import { IconGraph, IconExternalLink } from './icons';

interface Props {
  data: {
    skill: string;
    title: string;
    mermaid: string;
    diagramType?: string;
    status?: string;
  };
}

let mermaidReady = false;

/**
 * Mermaid 图表卡片 — 动态加载 mermaid 并渲染 LLM 生成的源码
 * 渲染失败时回退为源码展示，避免白屏
 */
export default function DiagramCard({ data }: Props) {
  const [svg, setSvg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [showSource, setShowSource] = useState(false);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    if (!data?.mermaid) {
      setErr('图表源码为空');
      return;
    }

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidReady) {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
          mermaidReady = true;
        }
        const { svg } = await mermaid.render(idRef.current, data.mermaid.trim());
        if (!cancelled) {
          setSvg(svg);
          setErr('');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '图表渲染失败');
      }
    })();

    return () => { cancelled = true; };
  }, [data?.mermaid]);

  return (
    <div className="hd-card" style={{ padding: 12 }}>
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconGraph size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{data.title || `${data.skill} 图解`}</span>
        </div>
        <button className="hd-btn secondary small" onClick={() => setShowSource((s) => !s)}>
          <IconExternalLink size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
          {showSource ? '看图' : '看源码'}
        </button>
      </div>

      {showSource ? (
        <pre
          style={{
            background: 'var(--paper-tint)',
            border: '1.5px solid var(--rule)',
            borderRadius: 8,
            padding: 12,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            margin: 0,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {data.mermaid}
        </pre>
      ) : err ? (
        <div>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
            图表渲染失败：{err}（已展示源码）
          </div>
          <pre
            style={{
              background: 'var(--paper-tint)',
              border: '1.5px solid var(--rule)',
              borderRadius: 8,
              padding: 12,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              margin: 0,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {data.mermaid}
          </pre>
        </div>
      ) : svg ? (
        <div
          style={{
            border: '2px solid var(--pencil)',
            borderRadius: 8,
            padding: 12,
            background: '#fff',
            overflow: 'auto',
            textAlign: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', padding: 20, textAlign: 'center' }}>
          正在渲染图表...
        </div>
      )}
    </div>
  );
}
