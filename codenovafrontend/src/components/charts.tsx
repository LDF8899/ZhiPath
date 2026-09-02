import { useId } from 'react';

/**
 * 手写 SVG 图表 —— 不引图表库，体积小且配色能和产品语言统一。
 */

export type RadarPoint = { name: string; value: number; max?: number };

/** 能力雷达图 */
export function RadarChart({
  points,
  size = 236,
  levels = 4,
  color = '#4f46e5',
}: {
  points: RadarPoint[];
  size?: number;
  levels?: number;
  color?: string;
}) {
  if (points.length < 3) return null;

  const center = size / 2;
  const radius = center - 32;

  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / points.length - Math.PI / 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio];
  };
  const ratioOf = (point: RadarPoint) =>
    Math.max(0, Math.min(1, (point.value ?? 0) / (point.max ?? 100)));

  const polygon = points.map((point, index) => pointAt(index, ratioOf(point)).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="能力雷达图">
      {Array.from({ length: levels }).map((_, level) => {
        const ratio = (level + 1) / levels;
        const ring = points.map((_, index) => pointAt(index, ratio).join(',')).join(' ');
        return (
          <polygon
            key={level}
            points={ring}
            fill={level === levels - 1 ? '#f7f8fb' : 'none'}
            stroke="#e8eaf0"
            strokeWidth={1}
          />
        );
      })}

      {points.map((_, index) => {
        const [x, y] = pointAt(index, 1);
        return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="#e8eaf0" strokeWidth={1} />;
      })}

      <polygon
        points={polygon}
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {points.map((point, index) => {
        const [x, y] = pointAt(index, ratioOf(point));
        return <circle key={index} cx={x} cy={y} r={3.2} fill={color} />;
      })}

      {points.map((point, index) => {
        const [x, y] = pointAt(index, 1.2);
        const anchor = Math.abs(x - center) < 6 ? 'middle' : x > center ? 'start' : 'end';
        return (
          <g key={`label-${index}`}>
            <text x={x} y={y} fontSize={11} fill="#6b7280" textAnchor={anchor} dominantBaseline="middle">
              {point.name.length > 6 ? `${point.name.slice(0, 6)}…` : point.name}
            </text>
            <text
              x={x}
              y={y + 13}
              fontSize={10}
              fontWeight={600}
              fill="#14161d"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {Math.round(point.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type Series = { key: string; label: string; color: string; values: number[] };

/** 多条折线 —— 用于资源难度匹配曲线（实际得分 vs 通过线） */
export function LineChart({
  labels,
  series,
  height = 200,
  yMax = 100,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yMax?: number;
}) {
  const gradientId = useId();
  const width = 560;
  const padding = { top: 14, right: 14, bottom: 26, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const pointX = (index: number) => padding.left + stepX * index;
  const pointY = (value: number) =>
    padding.top + innerH - (Math.max(0, Math.min(yMax, value)) / yMax) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} role="img" aria-label="难度匹配曲线">
      <defs>
        {series.map((item) => (
          <linearGradient key={item.key} id={`${gradientId}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={item.color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={item.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {[0, 25, 50, 75, 100].map((value) => (
        <g key={value}>
          <line
            x1={padding.left}
            y1={pointY(value)}
            x2={width - padding.right}
            y2={pointY(value)}
            stroke="#eef0f5"
            strokeWidth={1}
          />
          <text
            x={padding.left - 7}
            y={pointY(value)}
            fontSize={9.5}
            fill="#9aa1ad"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {value}
          </text>
        </g>
      ))}

      {series.map((item) => {
        if (item.values.length === 0) return null;
        const path = item.values
          .map((value, index) => `${index === 0 ? 'M' : 'L'}${pointX(index)},${pointY(value)}`)
          .join(' ');
        const area = `${path} L${pointX(item.values.length - 1)},${padding.top + innerH} L${pointX(0)},${
          padding.top + innerH
        } Z`;
        return (
          <g key={item.key}>
            <path d={area} fill={`url(#${gradientId}-${item.key})`} />
            <path
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {item.values.map((value, index) => (
              <circle
                key={index}
                cx={pointX(index)}
                cy={pointY(value)}
                r={3}
                fill="#fff"
                stroke={item.color}
                strokeWidth={2}
              />
            ))}
          </g>
        );
      })}

      {labels.map((label, index) => (
        <text key={label} x={pointX(index)} y={height - 8} fontSize={10.5} fill="#6b7280" textAnchor="middle">
          {label}
        </text>
      ))}
    </svg>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label} className="chart-legend__item">
          <i className="chart-legend__swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** 分组柱状图 —— 计划难度 vs 实际难度 */
export function GroupedBars({
  groups,
  series,
  height = 150,
  max = 100,
}: {
  groups: string[];
  series: Array<{ key: string; color: string; values: number[] }>;
  height?: number;
  max?: number;
}) {
  return (
    <div className="bars" style={{ height }}>
      {groups.map((label, index) => (
        <div className="bars__group" key={label}>
          <div className="bars__stack">
            {series.map((item) => (
              <div
                key={item.key}
                className="bars__bar"
                style={{
                  height: `${Math.max(3, (Math.min(max, item.values[index] ?? 0) / max) * 100)}%`,
                  background: item.color,
                }}
                title={`${item.key}: ${item.values[index] ?? 0}`}
              />
            ))}
          </div>
          <span className="tiny faint">{label}</span>
        </div>
      ))}
    </div>
  );
}
