import { useState } from 'react';
import { IconCode, IconRefresh, IconExternalLink } from './icons';

interface Props {
  data: {
    skill: string;
    title: string;
    html: string;
    status?: string;
  };
}

/**
 * HTML 动画演示卡片 — 在沙箱 iframe 中渲染 LLM 生成的自包含 HTML
 * sandbox 仅允许脚本执行，禁止同源/弹窗/表单，安全隔离
 */
export default function AnimationCard({ data }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  if (!data?.html) {
    return (
      <div className="hd-card" style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)' }}>
        动画内容为空
      </div>
    );
  }

  const openInNewTab = () => {
    const blob = new Blob([data.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="hd-card" style={{ padding: 12 }}>
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCode size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{data.title || `${data.skill} 动画演示`}</span>
        </div>
        <div className="hd-flex" style={{ gap: 6 }}>
          <button className="hd-btn secondary small" onClick={() => setReloadKey((k) => k + 1)} title="重新播放">
            <IconRefresh size={13} />
          </button>
          <button className="hd-btn secondary small" onClick={openInNewTab} title="新标签打开">
            <IconExternalLink size={13} />
          </button>
        </div>
      </div>

      <div
        style={{
          border: '2px solid var(--pencil)',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <iframe
          key={reloadKey}
          title={`anim-${data.skill}`}
          srcDoc={data.html}
          sandbox="allow-scripts"
          style={{ width: '100%', height: expanded ? 520 : 320, border: 'none', display: 'block' }}
        />
      </div>

      <button
        className="hd-btn secondary small"
        style={{ marginTop: 8 }}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? '收起' : '放大'}
      </button>
    </div>
  );
}
