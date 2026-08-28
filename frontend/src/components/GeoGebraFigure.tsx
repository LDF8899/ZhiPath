import { useEffect, useRef, useState } from 'react';

export interface GeoGebraFigureData {
  type: 'geogebra';
  commands: string[];
  view?: [number, number, number, number];
  axes?: boolean;
  grid?: boolean;
  view3d?: boolean;
  width?: number;
  height?: number;
}

const READY_TIMEOUT = 30000;

// 过滤掉可能导致 GeoGebra 报错弹窗的样式/设置命令
const FORBIDDEN = /^\s*(Set|Show|Delete|Rename|SetVisible|SetText|SetValue|SetColor|SetLineThickness|SetPointSize|SetAxesVisible|SetGridVisible|ShowGrid|ShowAxes|SetPerspective|SetCaption)/i;
function sanitizeCommands(cmds: string[]): string[] {
  return (cmds || [])
    .map((c) => String(c || '').replace(/\s+/g, ' ').trim())
    .filter((c) => c && !FORBIDDEN.test(c));
}

export default function GeoGebraFigure({ commands, view, axes = true, grid = false, view3d = false, width = 640, height = 420 }: GeoGebraFigureData) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let stop = false;

    const init = () => {
      if (stop) return;
      let win: any;
      try { win = (iframe as any).contentWindow; } catch { /* cross-origin */ }
      if (!win || !win.ggbApplet) {
        window.setTimeout(init, 200);
        return;
      }
      apiRef.current = win.ggbApplet;
      try {
        if (view3d) { try { win.ggbApplet.setPerspective('3'); if (win.ggbApplet.setView3D) win.ggbApplet.setView3D(); } catch (e) { /* ignore */ } }
        else if (view) win.ggbApplet.setCoordSystem(view[0], view[1], view[2], view[3]);
        else win.ggbApplet.setCoordSystem(-1, 8, 8, -1);
        win.ggbApplet.setAxesVisible(axes, axes);
        win.ggbApplet.setGridVisible(grid);
        sanitizeCommands(commands).forEach((cmd) => { try { win.ggbApplet.evalCommand(cmd); } catch (e) { /* skip */ } });
        setStatus('ready');
      } catch (e: any) { setStatus('error'); setError(String(e?.message || e)); }
    };

    const onLoad = () => init();
    iframe.addEventListener('load', onLoad);
    init();
    const timer = window.setTimeout(() => {
      if (!stop && !apiRef.current) { setStatus('error'); setError('GeoGebra 加载超时'); }
    }, READY_TIMEOUT);

    return () => { stop = true; window.clearTimeout(timer); iframe.removeEventListener('load', onLoad); };
  }, [commands, view, axes, grid]);

  const api = () => apiRef.current;

  const downloadDataUrl = (dataUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const exportPng = () => {
    const a = api();
    const data = typeof a?.getPNGBase64 === 'function' ? a.getPNGBase64(1, false, 2) : '';
    if (data) downloadDataUrl('data:image/png;base64,' + data, 'figure.png');
  };
  const exportSvg = () => {
    const a = api();
    const svg = typeof a?.exportSVG === 'function' ? a.exportSVG() : '';
    if (svg) {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url; el.download = 'figure.svg'; el.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="hd-card" style={{ margin: '8px 0', padding: 8 }}>
      <iframe
        ref={iframeRef}
        src="/geogebra/GeoGebra.html"
        title="GeoGebra"
        style={{ width, height: height + 53, borderRadius: 8, border: '1px solid var(--rule)', background: '#fff' }}
      />
      {status === 'loading' && <div style={{ fontSize: 12, color: 'var(--pencil)', marginTop: 4 }}>正在加载 GeoGebra 图形...</div>}
      {status === 'error' && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>{error || '图形加载失败'}</div>}
      {status === 'ready' && (
        <div className="hd-flex" style={{ gap: 8, marginTop: 6 }}>
          <button className="hd-btn secondary small" onClick={exportPng} type="button">导出 PNG</button>
          <button className="hd-btn secondary small" onClick={exportSvg} type="button">导出 SVG</button>
        </div>
      )}
    </div>
  );
}
