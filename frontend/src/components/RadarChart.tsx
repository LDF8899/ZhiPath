import '../styles/hand-draw.css';

type RadarPoint = {
  label?: string;
  name?: string;
  value?: number;
  score?: number;
  max?: number;
  trend?: 'up' | 'down' | 'stable';
};

interface RadarChartProps {
  data: RadarPoint[];
  compareData?: RadarPoint[];
  size?: number;
  color?: string;
  compareColor?: string;
  bgColor?: string;
  showTrend?: boolean;
  animated?: boolean;
  onDimensionClick?: (item: RadarPoint, index: number) => void;
}

export default function RadarChart({
  data,
  compareData,
  size = 200,
  color = 'var(--accent)',
  compareColor = 'var(--data-blue)',
  bgColor = 'var(--paper-tint)',
  showTrend = false,
  animated = false,
  onDimensionClick,
}: RadarChartProps) {
  const normalized = data.map(normalizePoint);
  const compare = compareData?.map(normalizePoint);
  const center = size / 2;
  const radius = size / 2 - 34;
  const levels = 5;
  const count = normalized.length;

  if (count < 3) return null;

  const jitter = (v: number, seed: number) => v + Math.sin(seed * 7.3) * 0.8;

  const getPoint = (index: number, value: number, max: number = 100) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (Math.max(0, Math.min(value, max)) / max) * radius;
    return {
      x: jitter(center + r * Math.cos(angle), index),
      y: jitter(center + r * Math.sin(angle), index + 0.5),
    };
  };

  const getPolygonPath = (level: number) => {
    const points = Array.from({ length: count }, (_, i) => {
      const r = (level / levels) * radius;
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const x = jitter(center + r * Math.cos(angle), i + level);
      const y = jitter(center + r * Math.sin(angle), i + 0.5 + level);
      return `${x},${y}`;
    });
    return points.join(' ');
  };

  const polygon = (items: ReturnType<typeof normalizePoint>[]) => items
    .map((d, i) => {
      const { x, y } = getPoint(i, d.value, d.max || 100);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: bgColor, borderRadius: 8 }}>
      {Array.from({ length: levels }, (_, i) => (
        <polygon
          key={i}
          points={getPolygonPath(i + 1)}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={i === levels - 1 ? 1.5 : 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={i === levels - 1 ? 0.3 : 0.12}
        />
      ))}

      {normalized.map((_, i) => {
        const { x, y } = getPoint(i, 100, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="var(--ink)"
            strokeWidth={0.5}
            strokeLinecap="round"
            opacity={0.12}
          />
        );
      })}

      {compare && compare.length === count && (
        <polygon
          points={polygon(compare)}
          fill={compareColor}
          fillOpacity={0.08}
          stroke={compareColor}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      <polygon
        points={polygon(normalized)}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={animated ? { transition: 'all 180ms ease' } : undefined}
      />

      {normalized.map((d, i) => {
        const { x, y } = getPoint(i, d.value, d.max || 100);
        const clickable = Boolean(onDimensionClick);
        return (
          <g key={i} onClick={() => onDimensionClick?.(data[i], i)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
            <circle cx={x} cy={y} r={4} fill={color} stroke="var(--paper)" strokeWidth={2} />
            <title>{`${d.label}: ${Math.round(d.value)}`}</title>
          </g>
        );
      })}

      {normalized.map((d, i) => {
        const { x, y } = getPoint(i, 116, 100);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--pencil)"
            fontFamily="'Patrick Hand', cursive"
          >
            {d.label}
            {showTrend && d.trend === 'up' ? ' ↑' : ''}
            {showTrend && d.trend === 'down' ? ' ↓' : ''}
          </text>
        );
      })}
    </svg>
  );
}

function normalizePoint(point: RadarPoint) {
  return {
    label: point.label || point.name || '',
    value: Number(point.value ?? point.score ?? 0),
    max: Number(point.max || 100),
    trend: point.trend || 'stable',
  };
}
