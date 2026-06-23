/* ──────────────────────────────────────────
   Landing Page — Hand-drawn SVG Icons
   Stroke-based, matching the paper/sketch aesthetic
   ────────────────────────────────────────── */

// 智能岗位匹配 — 准星/靶心
export function IconTarget() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0 0" />
      <circle cx="14" cy="14" r="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      <line x1="14" y1="1" x2="14" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="23" x2="14" y2="27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="1" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="14" x2="27" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 个性化学习路径 — 路线/分支
export function IconPath() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="22" cy="14" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="24" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 7.5 C12 10, 14 10, 19.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M8.5 7.5 C10 12, 10 16, 12 21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// AI 智能辅导员 — 机器人
export function IconRobot() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="10.5" cy="17" r="2" fill="currentColor" />
      <circle cx="17.5" cy="17" r="2" fill="currentColor" />
      <line x1="14" y1="4" x2="14" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="3" r="1.5" fill="currentColor" />
      <line x1="1" y1="15" x2="5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="15" x2="27" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 21 L18 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 技能雷达图 — 六边形雷达
export function IconRadar() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="14,2 25,8.5 25,19.5 14,26 3,19.5 3,8.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
      <polygon points="14,6 21,10 21,18 14,22 7,18 7,10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55" />
      <polygon points="14,10 17,12 17,16 14,18 11,16 11,12" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      <line x1="14" y1="14" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="14" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="14" x2="11" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 智能简历生成 — 文档+笔
export function IconDoc() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3 C6 2, 7 1, 8 1 L17 1 L22 6 L22 25 C22 26, 21 27, 20 27 L8 27 C7 27, 6 26, 6 25 Z" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M17 1 L17 6 L22 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
      <line x1="10" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="20" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 18 L24 14 C25 13, 27 15, 26 16 L22 20 L19 21 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// 企业直连 — 建筑
export function IconBuilding() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="20" height="18" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="8" y="2" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="8" y="12" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="13" y="12" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="18" y="12" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="8" y="18" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="13" y="18" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="18" y="18" width="3" height="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.4" />
      <rect x="11" y="22" width="6" height="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// 前端开发 — 代码/显示器
export function IconCode() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="24" height="17" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="8" y1="24" x2="20" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="20" x2="14" y2="24" stroke="currentColor" strokeWidth="2" />
      <polyline points="9,10 6,13 9,16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="19,10 22,13 19,16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="15" y1="9" x2="13" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 数据分析 — 上升趋势
export function IconTrendUp() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="2,22 8,14 14,17 22,5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="17,5 22,5 22,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="2" y1="25" x2="26" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <rect x="4" y="20" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.15" />
      <rect x="9" y="17" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.15" />
      <rect x="14" y="14" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.15" />
      <rect x="19" y="10" width="3" height="15" rx="0.5" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

// 勾选标记
export function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="3.5,9.5 7.5,13.5 14.5,4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
