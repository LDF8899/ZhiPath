import { Component, type ReactNode } from 'react';
import '../styles/hand-draw.css';
import { IconWarning } from './icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hd-page" style={{ minHeight: '100vh' }}>
          <div className="hd-empty" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 80 }}>
            <div style={{ marginBottom: 20 }}>
              <IconWarning size={56} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ font: '800 28px/1.2 var(--serif)', color: 'var(--ink)', margin: '0 0 12px' }}>
              页面渲染出错
            </h2>
            <pre style={{
              whiteSpace: 'pre-wrap',
              background: 'var(--paper-tint)',
              padding: 16,
              borderRadius: 10,
              border: '2px solid var(--pencil)',
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: 'var(--mono)',
              color: 'var(--ink)',
              textAlign: 'left',
              maxHeight: 240,
              overflowY: 'auto',
            }}>
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button
              className="hd-btn"
              style={{ marginTop: 20 }}
              onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            >
              清除缓存并重新登录
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
