import type { MotionEase } from './runtime';
import type { MotionStyleId, VisualStyleId } from './types';

export interface MotionPreset {
  enterEase: MotionEase;
  cameraEase: MotionEase;
  exitEase: MotionEase;
  introPortion: number;
  outroPortion: number;
  cameraTravel: number;
  cameraLift: number;
  cameraScaleBoost: number;
  tilt: number;
  energy: number;
  wipeSkew: number;
}

export const MOTION_PRESETS: Record<MotionStyleId, MotionPreset> = {
  'gentle-editorial': {
    enterEase: 'power2.out',
    cameraEase: 'sine.inOut',
    exitEase: 'power2.inOut',
    introPortion: 0.12,
    outroPortion: 0.08,
    cameraTravel: 18,
    cameraLift: 10,
    cameraScaleBoost: 0.035,
    tilt: 0.45,
    energy: 0.65,
    wipeSkew: 10,
  },
  'precise-ui': {
    enterEase: 'power3.out',
    cameraEase: 'power2.inOut',
    exitEase: 'power2.inOut',
    introPortion: 0.09,
    outroPortion: 0.06,
    cameraTravel: 12,
    cameraLift: 6,
    cameraScaleBoost: 0.022,
    tilt: 0.18,
    energy: 0.42,
    wipeSkew: 0,
  },
  'terminal-scan': {
    enterEase: 'expo.out',
    cameraEase: 'power1.out',
    exitEase: 'power2.inOut',
    introPortion: 0.08,
    outroPortion: 0.05,
    cameraTravel: 8,
    cameraLift: 4,
    cameraScaleBoost: 0.018,
    tilt: 0,
    energy: 1,
    wipeSkew: 0,
  },
  cinematic: {
    enterEase: 'power3.out',
    cameraEase: 'power3.inOut',
    exitEase: 'power3.inOut',
    introPortion: 0.16,
    outroPortion: 0.12,
    cameraTravel: 28,
    cameraLift: 16,
    cameraScaleBoost: 0.065,
    tilt: 0.7,
    energy: 0.82,
    wipeSkew: 14,
  },
};

const DEFAULT_MOTION_BY_VISUAL: Record<VisualStyleId, MotionStyleId> = {
  'editorial-paper': 'gentle-editorial',
  'precision-mono': 'precise-ui',
  'terminal-grid': 'terminal-scan',
  'cinematic-product': 'cinematic',
};

export function resolveMotionStyle(visualStyle: VisualStyleId, requested?: MotionStyleId) {
  return requested || DEFAULT_MOTION_BY_VISUAL[visualStyle];
}
