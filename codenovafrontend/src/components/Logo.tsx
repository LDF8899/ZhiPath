import { useId } from 'react';

/* ────────────────────────────────────────────────────────────
   CodeNova 品牌标 —— 「超新星爆发」
   白炽星核 + 冰蓝→紫渐变冕层 + 八向星芒 + 斜置轨道。
   无底色块，深浅背景均可直接使用。
   ──────────────────────────────────────────────────────────── */

export function Logo({
  size = 33,
  orbit = true,
  glow = true,
}: {
  size?: number;
  orbit?: boolean;
  glow?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const core = `nova-core-${uid}`;
  const ray = `nova-ray-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="CodeNova"
      style={glow ? { filter: 'drop-shadow(0 2px 8px rgba(99,102,241,.45))' } : undefined}
    >
      <defs>
        <radialGradient id={core} cx="42%" cy="38%" r="68%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor="#bae6fd" />
          <stop offset="52%" stopColor="#818cf8" />
          <stop offset="82%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>
        <linearGradient id={ray} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>

      {/* 八向星芒：四长（正方向）四短（对角） */}
      <g fill={`url(#${ray})`}>
        {/* 上 */}
        <path d="M24 1.5 L26.4 19.5 L24 23.5 L21.6 19.5 Z" />
        {/* 下 */}
        <path d="M24 46.5 L26.4 28.5 L24 24.5 L21.6 28.5 Z" />
        {/* 左 */}
        <path d="M1.5 24 L19.5 21.6 L23.5 24 L19.5 26.4 Z" />
        {/* 右 */}
        <path d="M46.5 24 L28.5 21.6 L24.5 24 L28.5 26.4 Z" />
      </g>
      <g fill={`url(#${ray})`} opacity="0.82">
        {/* 对角短芒 */}
        <path d="M8 8 L20 18.5 L21 21 L18.5 20 Z" />
        <path d="M40 8 L28 18.5 L27 21 L29.5 20 Z" />
        <path d="M8 40 L18.5 28 L21 27 L20 29.5 Z" />
        <path d="M40 40 L29.5 28 L27 27 L28 29.5 Z" />
      </g>

      {/* 星核 */}
      <circle cx="24" cy="24" r="9.5" fill={`url(#${core})`} />
      <circle cx="21" cy="20.5" r="2.6" fill="#ffffff" opacity="0.9" />

      {/* 斜置轨道 + 卫星 */}
      {orbit && (
        <g transform="rotate(-24 24 24)">
          <ellipse
            cx="24"
            cy="24"
            rx="19"
            ry="7"
            stroke="#a5b4fc"
            strokeWidth="1"
            opacity="0.55"
            fill="none"
            strokeDasharray="2.5 3.5"
          />
          <circle cx="43" cy="24" r="2" fill="#22d3ee" />
        </g>
      )}
    </svg>
  );
}

/** 品牌组合：Logo + 名称（rail / landing 共用） */
export function BrandMark({
  nameSize = 14,
  sub,
  logoSize = 33,
}: {
  nameSize?: number;
  sub?: string;
  logoSize?: number;
}) {
  return (
    <>
      <Logo size={logoSize} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="brand__name" style={{ fontSize: nameSize }}>CodeNova</div>
        {sub && <div className="brand__sub">{sub}</div>}
      </div>
    </>
  );
}
