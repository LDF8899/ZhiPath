import { ClientExperienceService } from './client-experience.service';

describe('ClientExperienceService', () => {
  it('composes client-specific navigation without branching core business logic', async () => {
    const appRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        clientKey: 'codenova-web',
        name: 'CodeNova',
        configVersion: 1,
        themeConfig: { brand: 'codenova' },
      }),
    };
    const featureRepo = {
      find: jest.fn().mockResolvedValue([
        {
          featureKey: 'dashboard',
          enabled: 1,
          rolloutPercent: 100,
          config: { route: '/today', label: '今日学习', order: 10 },
        },
        {
          featureKey: 'experimental-lab',
          enabled: 1,
          rolloutPercent: 0,
          config: { route: '/lab', label: '实验室', order: 20 },
        },
      ]),
    };
    const preferenceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const auth = {
      getMe: jest.fn().mockResolvedValue({
        id: 1,
        username: 'learner',
        role: 'student',
        onboardingCompleted: true,
      }),
    };
    const access = {
      getIdentityContext: jest.fn().mockResolvedValue({
        tenant: { id: 1, key: 'platform-default', name: '平台', type: 'platform' },
        roles: ['student'],
        scopes: ['learning:read'],
      }),
    };
    const service = new ClientExperienceService(
      appRepo as any,
      featureRepo as any,
      preferenceRepo as any,
      auth as any,
      access as any,
      {} as any,
      {} as any,
    );

    const result = await service.bootstrap('codenova-web', 1, 1);

    expect(result.client.key).toBe('codenova-web');
    expect(result.navigation).toEqual([
      { key: 'dashboard', route: '/today', label: '今日学习', order: 10 },
    ]);
    expect(result.permissions).toEqual(['learning:read']);
    expect(result.features['experimental-lab'].enabled).toBe(false);
    expect(preferenceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, clientAppId: 2, tenantId: 1 }),
    );
    expect(auth.getMe).toHaveBeenCalledWith(1, 1);
    expect(access.getIdentityContext).toHaveBeenCalledWith(1, 1);
  });

  it('composes home sections from feature registration instead of client-name branches', async () => {
    const appRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        clientKey: 'campus-web',
        configVersion: 3,
      }),
    };
    const featureRepo = {
      find: jest.fn().mockResolvedValue([
        { featureKey: 'dashboard', enabled: 1, rolloutPercent: 100 },
        { featureKey: 'learning-paths', enabled: 1, rolloutPercent: 100 },
        { featureKey: 'assessment', enabled: 0, rolloutPercent: 100 },
      ]),
    };
    const dataSource = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('AS activePaths')) {
          return [{ activePaths: '2', dueActivities: '3', inProgressActivities: '1', completedToday: '4', pendingJobs: '0' }];
        }
        if (sql.includes('FROM learning_paths path')) {
          return [{ id: 'path-1', name: '校园路径', status: 'active' }];
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
    };
    const service = new ClientExperienceService(
      appRepo as any,
      featureRepo as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      {} as any,
    );

    const result = await service.home('campus-web', 4, 9);

    expect(result.client).toEqual({ key: 'campus-web', configVersion: 3 });
    expect(result.sections.dashboard).toEqual({
      activePaths: 2,
      dueActivities: 3,
      inProgressActivities: 1,
      completedToday: 4,
      pendingJobs: 0,
    });
    expect(result.sections.learningPaths).toEqual({
      items: [{ id: 'path-1', name: '校园路径', status: 'active' }],
    });
    expect(result.sections).not.toHaveProperty('assessment');
    expect(dataSource.query).toHaveBeenCalledTimes(2);
  });

  it('creates a client, its features, an outbox event and an audit record atomically', async () => {
    const savedClient = {
      id: 3,
      clientKey: 'campus-web',
      name: '校园版',
      configVersion: 1,
      allowedOrigins: ['https://campus.example.com'],
    };
    const appRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }) =>
        where.clientKey === 'zhipath-web' ? { id: 1 } : null,
      ),
      save: jest.fn().mockResolvedValue(savedClient),
    };
    const featureRepo = { save: jest.fn().mockImplementation(async (value) => value) };
    const manager = {
      getRepository: jest.fn().mockImplementation((entity) =>
        entity.name === 'ClientApp' ? appRepo : featureRepo,
      ),
      query: jest.fn().mockResolvedValue({}),
    };
    const dataSource = {
      transaction: jest.fn().mockImplementation(async (work) => work(manager)),
    };
    const service = new ClientExperienceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      { invalidate: jest.fn() } as any,
    );

    const result = await service.createClient(
      {
        clientKey: 'campus-web',
        name: '校园版',
        allowedOrigins: ['https://campus.example.com'],
        features: ['dashboard'],
      },
      {
        tenantId: 1,
        actorUserId: 2,
        actorClientKey: 'zhipath-web',
        requestId: 'request-create-client',
      },
    );

    expect(result.key).toBe('campus-web');
    expect(featureRepo.save).toHaveBeenCalledWith(expect.objectContaining({ featureKey: 'dashboard' }));
    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(manager.query.mock.calls[0][0]).toContain('INSERT INTO outbox_events');
    expect(manager.query.mock.calls[1][0]).toContain('INSERT INTO audit_logs');
  });

  it('rejects unsafe origins before opening a transaction', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new ClientExperienceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      { invalidate: jest.fn() } as any,
    );

    await expect(
      service.createClient(
        {
          clientKey: 'unsafe-web',
          name: '不安全客户端',
          allowedOrigins: ['javascript:alert(1)'],
        },
        {
          tenantId: 1,
          actorUserId: 2,
          actorClientKey: 'zhipath-web',
          requestId: 'request-unsafe-client',
        },
      ),
    ).rejects.toThrow('allowedOrigins 仅允许 HTTP/HTTPS 地址');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
