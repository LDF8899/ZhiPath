import { Link } from 'react-router-dom';
import '../styles/hand-draw.css';
import { IconDocument, IconBook, IconImage, IconLink } from './icons';

interface ResourceItem {
  title: string;
  url: string;
  type: string;
}

interface Props {
  data: ResourceItem[];
}

const typeIcons: Record<string, React.ReactNode> = {
  '文档': <IconDocument size={16} />,
  '教程': <IconBook size={16} />,
  '视频': <IconImage size={16} />,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'var(--ink)',
  transition: 'background 0.15s',
};

const hoverBg = 'var(--paper-tint)';

function ResourceItemRow({ res }: { res: ResourceItem }) {
  const icon = typeIcons[res.type] || <IconLink size={16} />;
  const isExternal = res.url && /^https?:\/\//i.test(res.url);

  if (isExternal) {
    return (
      <a
        href={res.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hd-flex"
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: 'var(--pencil)', display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</span>
        <span className="hd-tag">{res.type}</span>
      </a>
    );
  }

  if (res.url) {
    return (
      <Link
        to={res.url}
        className="hd-flex"
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: 'var(--pencil)', display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</span>
        <span className="hd-tag">{res.type}</span>
      </Link>
    );
  }

  // No URL — show as plain text item
  return (
    <div className="hd-flex" style={{ ...itemStyle, opacity: 0.6, cursor: 'default' }}>
      <span style={{ color: 'var(--pencil)', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</span>
      <span className="hd-tag">{res.type}</span>
    </div>
  );
}

export default function ResourceCard({ data }: Props) {
  return (
    <div className="hd-card">
      <div style={{ fontWeight: 700, fontFamily: 'var(--hand-bold)', fontSize: 15, marginBottom: 10 }}>推荐资源</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((res, i) => (
          <ResourceItemRow key={i} res={res} />
        ))}
      </div>
    </div>
  );
}
