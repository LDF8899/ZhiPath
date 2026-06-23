import '../styles/hand-draw.css';

/**
 * 雷达图组件（SVG 实现，手绘风格）
 */
interface RadarChartProps {
  data: Array<{ label: string; value: number; max?: number }>;
  size?: number;
  color?: string;
  bgColor?: string;
}

export default function RadarChart({
  data,
  size = 200,
  color = 'var(--accent)',
  bgColor = 'var(--paper-tint)',
}: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const levels = 5;
  const count = data.length;

  if (count < 3) return null;

  const jitter = (v: number, seed: number) => v + Math.sin(seed * 7.3) * 0.8;

  const getPoint = (index: number, value: number, max: number = 100) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / max) * radius;
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

  const dataPath = data
    .map((d, i) => {
      const { x, y } = getPoint(i, d.value, d.max || 100);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景网格 */}
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

      {/* 轴线 */}
      {data.map((_, i) => {
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

      {/* 数据区域 */}
      <polygon
        points={dataPath}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {data.map((d, i) => {
        const { x, y } = getPoint(i, d.value, d.max || 100);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={4}
            fill={color}
            stroke="var(--paper)"
            strokeWidth={2}
          />
        );
      })}

      {/* 标签 */}
      {data.map((d, i) => {
        const { x, y } = getPoint(i, 115, 100);
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
          </text>
        );
      })}
    </svg>
  );
}
