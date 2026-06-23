import '../styles/hand-draw.css';
import { IconDocument, IconBook, IconImage, IconLink } from './icons';

interface Props {
  data: Array<{
    title: string;
    url: string;
    type: string;
  }>;
}

const typeIcons: Record<string, React.ReactNode> = {
  '文档': <IconDocument size={16} />,
  '教程': <IconBook size={16} />,
  '视频': <IconImage size={16} />,
};

export default function ResourceCard({ data }: Props) {
  return (
    <div className="hd-card">
      <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15, marginBottom: 10 }}>推荐资源</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((res, i) => (
          <a
            key={i}
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hd-flex"
            style={{
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'var(--ink)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-tint)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: 'var(--pencil)', display: 'flex', alignItems: 'center' }}>
              {typeIcons[res.type] || <IconLink size={16} />}
            </span>
            <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</span>
            <span className="hd-tag">{res.type}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
