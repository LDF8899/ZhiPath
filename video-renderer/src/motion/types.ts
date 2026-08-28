export const VISUAL_STYLE_IDS = [
  'editorial-paper',
  'precision-mono',
  'terminal-grid',
  'cinematic-product',
] as const;

export type VisualStyleId = (typeof VISUAL_STYLE_IDS)[number];

export const MOTION_STYLE_IDS = [
  'gentle-editorial',
  'precise-ui',
  'terminal-scan',
  'cinematic',
] as const;

export type MotionStyleId = (typeof MOTION_STYLE_IDS)[number];

export interface SceneStyleSpec {
  visualStyle?: VisualStyleId;
  motionStyle?: MotionStyleId;
}

export function isVisualStyleId(value: unknown): value is VisualStyleId {
  return typeof value === 'string' && VISUAL_STYLE_IDS.includes(value as VisualStyleId);
}

export function isMotionStyleId(value: unknown): value is MotionStyleId {
  return typeof value === 'string' && MOTION_STYLE_IDS.includes(value as MotionStyleId);
}
