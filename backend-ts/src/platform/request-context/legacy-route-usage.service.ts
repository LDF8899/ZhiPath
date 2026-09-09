import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type LegacyRouteUsageRecord = {
  tenantId?: number | null;
  clientApp?: string | null;
  method: string;
  routePattern: string;
  statusCode: number;
};

@Injectable()
export class LegacyRouteUsageService {
  private readonly logger = new Logger(LegacyRouteUsageService.name);

  constructor(private readonly dataSource: DataSource) {}

  isLegacyPath(path: string): boolean {
    return /^\/api\/(?:user(?:\/|$)|admin\/auth(?:\/|$))/.test(path);
  }

  record(input: LegacyRouteUsageRecord): void {
    const path = input.routePattern.slice(0, 500);
    if (!this.isLegacyPath(path)) return;
    void this.dataSource.query(
      `INSERT INTO api_route_usage_daily
        (usage_date, tenant_id, client_app, method, route_pattern, request_count, error_count, last_status_code, last_used_at)
       VALUES (CURRENT_DATE(), ?, ?, ?, ?, 1, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         request_count = request_count + 1,
         error_count = error_count + VALUES(error_count),
         last_status_code = VALUES(last_status_code),
         last_used_at = VALUES(last_used_at)`,
      [
        Number(input.tenantId || 0),
        String(input.clientApp || 'unknown').slice(0, 100),
        input.method.slice(0, 10),
        path,
        input.statusCode >= 400 ? 1 : 0,
        input.statusCode,
      ],
    ).catch((error) => this.logger.warn(`兼容路由调用统计写入失败: ${error?.message || error}`));
  }

  async list(days = 30, clientApp?: string) {
    const safeDays = Math.max(1, Math.min(365, Math.round(days || 30)));
    const clientClause = clientApp ? ' AND client_app = ?' : '';
    const params = clientApp ? [safeDays, clientApp] : [safeDays];
    return this.dataSource.query(
      `SELECT usage_date AS usageDate, tenant_id AS tenantId, client_app AS clientApp,
              method, route_pattern AS routePattern, request_count AS requestCount,
              error_count AS errorCount, last_status_code AS lastStatusCode,
              last_used_at AS lastUsedAt
         FROM api_route_usage_daily
        WHERE usage_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)${clientClause}
        ORDER BY usage_date DESC, request_count DESC, route_pattern ASC`,
      params,
    );
  }
}
