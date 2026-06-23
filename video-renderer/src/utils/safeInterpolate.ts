import { interpolate } from 'remotion';

/**
 * 安全的 interpolate 包装
 *
 * 当 outputRange 中存在 undefined / NaN / null 时，
 * 返回 fallback 而不是让 Remotion 抛出 outputRange 校验错误。
 */
export function safeInterpolate(
  input: number,
  inputRange: number[],
  outputRange: number[],
  fallback = 0,
): number {
  // 检查 outputRange 中是否有非法值
  if (outputRange.some((v) => !Number.isFinite(v))) {
    return fallback;
  }
  // 检查 inputRange 中是否有非法值
  if (inputRange.some((v) => !Number.isFinite(v))) {
    return fallback;
  }
  return interpolate(input, inputRange, outputRange);
}

/**
 * 确保值是有限数字，否则返回 fallback
 */
export function ensureFinite(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}
