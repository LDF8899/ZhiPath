import { gsap } from 'gsap';

export type MotionEase =
  | 'none'
  | 'power1.out'
  | 'power2.out'
  | 'power2.inOut'
  | 'power3.out'
  | 'power3.inOut'
  | 'expo.out'
  | 'sine.inOut';

const easeCache = new Map<MotionEase, (progress: number) => number>();

function getEase(name: MotionEase) {
  const cached = easeCache.get(name);
  if (cached) return cached;

  const ease = gsap.parseEase(name);
  easeCache.set(name, ease);
  return ease;
}

export function motionProgress(
  frame: number,
  startFrame: number,
  endFrame: number,
  ease: MotionEase = 'power2.out',
) {
  if (endFrame <= startFrame) return frame >= endFrame ? 1 : 0;
  const linear = gsap.utils.clamp(0, 1, (frame - startFrame) / (endFrame - startFrame));
  return getEase(ease)(linear);
}

export function motionInterpolate(from: number, to: number, progress: number) {
  return gsap.utils.interpolate(from, to, gsap.utils.clamp(0, 1, progress));
}

// Keep GSAP behind this facade. Advanced plugins can be added here without
// coupling compositions to GSAP's internal modules.
export const motionRuntimeVersion = gsap.version;
