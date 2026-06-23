/** snake_case → camelCase 递归转换 */
export function snakeToCamel<T = any>(obj: any): T {
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as any;
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        snakeToCamel(v),
      ]),
    ) as any;
  }
  return obj;
}
