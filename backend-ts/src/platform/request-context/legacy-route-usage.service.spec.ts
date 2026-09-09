import { LegacyRouteUsageService } from './legacy-route-usage.service';

describe('LegacyRouteUsageService', () => {
  it('recognizes only the documented compatibility prefixes', () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
    const service = new LegacyRouteUsageService(dataSource);
    expect(service.isLegacyPath('/api/user/learning-domains')).toBe(true);
    expect(service.isLegacyPath('/api/admin/auth/login')).toBe(true);
    expect(service.isLegacyPath('/api/v1/learning-paths')).toBe(false);
    expect(service.isLegacyPath('/api/userland')).toBe(false);
  });

  it('writes a normalized daily usage upsert for legacy requests', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
    const service = new LegacyRouteUsageService(dataSource);
    service.record({ tenantId: 7, clientApp: 'zhipath-web', method: 'GET', routePattern: '/api/user/learning-paths/:id', statusCode: 200 });
    await new Promise((resolve) => setImmediate(resolve));
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ON DUPLICATE KEY UPDATE'), [7, 'zhipath-web', 'GET', '/api/user/learning-paths/:id', 0, 200]);
  });
});
