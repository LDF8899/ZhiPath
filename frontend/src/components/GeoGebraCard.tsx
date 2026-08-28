import FigureRenderer from './FigureRenderer';
import { IconDocument } from './icons';
import '../styles/hand-draw.css';

export default function GeoGebraCard({ data }: { data: any }) {
  const subject = data?.subject || data?.topic || '数学图形';
  return (
    <div className="hd-card">
      <div className="hd-flex" style={{ marginBottom: 8 }}>
        <div className="hd-avatar" style={{ background: 'var(--highlight)' }}>
          <IconDocument size={18} />
        </div>
        <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15 }}>{subject}</div>
      </div>
      <FigureRenderer figure={data} />
    </div>
  );
}
