import { RequestContextMiddleware } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  it('accepts a registered client and returns correlation headers', () => {
    const request: any = {
      headers: {
        'x-request-id': 'request-123',
        'x-client-app': 'zhipath-web',
        'x-client-version': '2.0.0',
      },
    };
    const response: any = { setHeader: jest.fn() };
    const next = jest.fn();

    new RequestContextMiddleware().use(request, response, next);

    expect(request.requestContext).toMatchObject({
      requestId: 'request-123',
      clientApp: 'zhipath-web',
      clientVersion: '2.0.0',
    });
    expect(response.setHeader).toHaveBeenCalledWith('X-Client-App', 'zhipath-web');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('marks a missing client key as unknown', () => {
    const request: any = { headers: {} };
    const response: any = { setHeader: jest.fn() };

    new RequestContextMiddleware().use(request, response, jest.fn());

    expect(request.requestContext.clientApp).toBe('unknown');
    expect(request.requestContext.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reads the client key from an EventSource query parameter', () => {
    const request: any = {
      headers: {},
      query: { client_app: 'codenova-web' },
    };
    const response: any = { setHeader: jest.fn() };

    new RequestContextMiddleware().use(request, response, jest.fn());

    expect(request.requestContext.clientApp).toBe('codenova-web');
  });

  it('marks legacy user and auth routes as deprecated without affecting v1 routes', () => {
    const legacyResponse: any = { setHeader: jest.fn() };
    new RequestContextMiddleware().use(
      { headers: {}, originalUrl: '/api/user/dashboard' } as any,
      legacyResponse,
      jest.fn(),
    );
    expect(legacyResponse.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(legacyResponse.setHeader).toHaveBeenCalledWith(
      'Sunset',
      'Thu, 30 Sep 2027 00:00:00 GMT',
    );

    const v1Response: any = { setHeader: jest.fn() };
    new RequestContextMiddleware().use(
      { headers: {}, originalUrl: '/api/v1/auth/login' } as any,
      v1Response,
      jest.fn(),
    );
    expect(v1Response.setHeader).not.toHaveBeenCalledWith('Deprecation', expect.anything());
  });
});
