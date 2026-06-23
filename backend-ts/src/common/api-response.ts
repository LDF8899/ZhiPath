/**
 * 统一响应格式 — 对齐 Python schemas/base.py
 */

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PageResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 成功响应 */
export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 200, message, data };
}

/** 分页响应 */
export function pageSuccess<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResponse<T> {
  return { code: 200, message: 'success', data, total, page, pageSize };
}

/** 错误响应 */
export function error(code: number, message: string): ApiResponse<null> {
  return { code, message, data: null };
}
