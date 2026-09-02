/**
 * NOVA 恒星光谱 — 3D 星图配色
 * 按簇序号循环取色，全部来自 tokens.css 的 nova 色系
 */
export const CLUSTER_PALETTE = [
  '#22d3ee', // nova-ice
  '#818cf8', // nova-indigo
  '#a855f7', // nova-violet
  '#ec4899', // nova-pink
  '#f59e0b', // nova-gold
  '#34d399', // 绿（结业态补充）
];

export function clusterColor(clusterIndex: number): string {
  return CLUSTER_PALETTE[clusterIndex % CLUSTER_PALETTE.length];
}

/** 深空背景（与 tokens --space-950 对齐） */
export const SPACE_BG = '#050816';
