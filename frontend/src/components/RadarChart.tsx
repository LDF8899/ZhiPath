import '../styles/hand-draw.css';

type RadarPoint = {
  label?: string;
  name?: string;
  value?: number;
  score?: number;
  max?: number;
  trend?: 'up' | 'down' | 'stable';
};

type NormalizedPoint = {
  label: string;
  value: number;
  max: number;
  trend: 'up' | 'down' | 'stable';
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
  showSummary?: boolean;
  onDimensionClick?: (item: RadarPoint, index: number) => void;
}

const LEVELS = [20, 40, 60, 80, 100];

export default function RadarChart({
  data,
  compareData,
  size = 240,
  color = 'var(--accent)',
  compareColor = 'var(--data-blue)',
  bgColor = 'transparent',
  showTrend = false,
  animated = false,
  showSummary = true,
  onDimensionClick,
}: RadarChartProps) {
  const normalized = data.map(normalizePoint).filter((item) => item.label);
  const count = normalized.length;

  if (count === 0) {
    return <div className="radar-empty">暂无技能画像数据</div>;
  }

  if (count < 3) {
    return <CompactSkillBars data={normalized} color={color} />;
  }

  const compare = alignCompareData(normalized, compareData);
  const center = size / 2;
  const radius = Math.max(70, size / 2 - 58);
  const labelRadius = radius + 34;
  const scoreRadius = radius + 16;
  const average = Math.round(normalized.reduce((sum, item) => sum + item.value, 0) / count);
  const strongest = [...normalized].sort((a, b) => b.value - a.value)[0];
  const weakest = [...normalized].sort((a, b) => a.value - b.value)[0];
  const focusItems = [...normalized].sort((a, b) => a.value - b.value).slice(0, 2);
  const clickable = Boolean(onDimensionClick);

  const getPoint = (index: number, value: number, max = 100, pointRadius = radius) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const safeValue = clamp(value, 0, max);
    const r = (safeValue / max) * pointRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      angle,
    };
  };

  const polygon = (items: NormalizedPoint[], pointRadius = radius) => items
    .map((d, i) => {
      const { x, y } = getPoint(i, d.value, d.max, pointRadius);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const gridPolygon = (level: number) => normalized
    .map((_, i) => {
      const { x, y } = getPoint(i, level, 100, radius);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const status = getRadarStatus(average, weakest.value);

  return (
    <div className="radar-shell" style={{ '--radar-color': color, '--radar-compare-color': compareColor } as React.CSSProperties}>
      <div className="radar-visual-wrap" style={{ background: bgColor }}>
        {compare && (
          <div className="radar-legend">
            <span><i className="current" />当前</span>
            <span><i className="compare" />对比</span>
          </div>
        )}
        <svg
          className="radar-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`技能雷达图，平均分 ${average}，最高 ${strongest.label} ${Math.round(strongest.value)}，最低 ${weakest.label} ${Math.round(weakest.value)}`}
        >
          {LEVELS.map((level) => (
            <polygon
              key={level}
              points={gridPolygon(level)}
              fill={level === 60 ? 'rgba(249, 210, 124, 0.12)' : 'none'}
              stroke="var(--ink)"
              strokeWidth={level === 100 ? 1.4 : 0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={level === 100 ? 0.34 : 0.16}
            />
          ))}

          {LEVELS.slice(0, 4).map((level) => {
            const y = center - (level / 100) * radius;
            return (
              <text key={level} x={center + 5} y={y + 3} className="radar-tick">
                {level}
              </text>
            );
          })}

          {normalized.map((_, i) => {
            const { x, y } = getPoint(i, 100);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="var(--ink)"
                strokeWidth={0.7}
                strokeLinecap="round"
                opacity={0.14}
              />
            );
          })}

          {compare && (
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
            fillOpacity={0.18}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={animated ? { transition: 'all 180ms ease' } : undefined}
          />

          {normalized.map((d, i) => {
            const point = getPoint(i, d.value, d.max);
            return (
              <g key={d.label} onClick={() => onDimensionClick?.(data[i], i)} className={clickable ? 'radar-point clickable' : 'radar-point'}>
                <circle cx={point.x} cy={point.y} r={5} fill={color} stroke="var(--paper)" strokeWidth={2.2} />
                <circle cx={point.x} cy={point.y} r={9} fill="transparent" />
                <title>{`${d.label}: ${Math.round(d.value)}`}</title>
              </g>
            );
          })}

          {normalized.map((d, i) => {
            const labelPoint = getPoint(i, 100, 100, labelRadius);
            const scorePoint = getPoint(i, 100, 100, scoreRadius);
            const anchor = getTextAnchor(labelPoint.x, center);
            const labelLines = splitLabel(d.label);
            return (
              <g key={`${d.label}-label`}>
                <text
                  x={labelPoint.x}
                  y={labelPoint.y - (labelLines.length > 1 ? 5 : 0)}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="radar-label"
                >
                  {labelLines.map((line, lineIndex) => (
                    <tspan key={line} x={labelPoint.x} dy={lineIndex === 0 ? 0 : 12}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <text
                  x={scorePoint.x}
                  y={scorePoint.y + 4}
                  textAnchor="middle"
                  className={`radar-score ${getScoreTone(d.value)}`}
                >
                  {Math.round(d.value)}
                  {showTrend ? trendMark(d.trend) : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {showSummary && (
        <div className="radar-summary">
          <div className="radar-summary-main">
            <span className={`radar-score-badge ${status.tone}`}>{average}</span>
            <div>
              <div className="radar-summary-title">{status.title}</div>
              <div className="radar-summary-desc">
                强项 {strongest.label} {Math.round(strongest.value)}，优先补 {weakest.label} {Math.round(weakest.value)}
              </div>
            </div>
          </div>
          <div className="radar-focus-list">
            {focusItems.map((item) => (
              <span key={item.label} className={`radar-focus-chip ${getScoreTone(item.value)}`}>
                {item.label} {Math.round(item.value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactSkillBars({ data, color }: { data: NormalizedPoint[]; color: string }) {
  return (
    <div className="radar-bars" style={{ '--radar-color': color } as React.CSSProperties}>
      {data.map((item) => (
        <div key={item.label} className="radar-bar-row">
          <div className="radar-bar-head">
            <span>{item.label}</span>
            <b>{Math.round(item.value)}</b>
          </div>
          <div className="radar-bar-track">
            <div className="radar-bar-fill" style={{ width: `${(clamp(item.value, 0, item.max) / item.max) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="radar-empty small">至少 3 个维度后会形成雷达图</div>
    </div>
  );
}

function normalizePoint(point: RadarPoint): NormalizedPoint {
  return {
    label: point.label || point.name || '',
    value: clamp(Number(point.value ?? point.score ?? 0), 0, Number(point.max || 100)),
    max: Number(point.max || 100),
    trend: point.trend || 'stable',
  };
}

function alignCompareData(current: NormalizedPoint[], compareData?: RadarPoint[]) {
  if (!compareData?.length) return null;
  const compareMap = new Map(compareData.map((item) => {
    const normalized = normalizePoint(item);
    return [normalized.label, normalized];
  }));
  const aligned = current.map((item) => compareMap.get(item.label) || { ...item, value: 0, trend: 'stable' as const });
  return aligned.length === current.length ? aligned : null;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(value, max));
}

function splitLabel(label: string) {
  if (label.length <= 6) return [label];
  if (label.includes('/')) return label.split('/').slice(0, 2);
  return [label.slice(0, 6), label.slice(6, 12)];
}

function getTextAnchor(x: number, center: number) {
  if (Math.abs(x - center) < 10) return 'middle';
  return x > center ? 'start' : 'end';
}

function getScoreTone(value: number) {
  if (value >= 75) return 'strong';
  if (value >= 60) return 'ok';
  return 'weak';
}

function trendMark(trend: NormalizedPoint['trend']) {
  if (trend === 'up') return ' +';
  if (trend === 'down') return ' -';
  return '';
}

function getRadarStatus(average: number, weakest: number) {
  if (average >= 75 && weakest >= 60) {
    return { tone: 'strong', title: '能力结构稳定' };
  }
  if (average >= 60) {
    return { tone: 'ok', title: '具备岗位基础' };
  }
  if (average >= 40) {
    return { tone: 'weak', title: '需要定向补强' };
  }
  return { tone: 'weak', title: '画像仍需积累' };
}
