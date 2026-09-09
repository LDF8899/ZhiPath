import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function executionContext(request: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('AuthGuard client binding', () => {
  it('accepts an access token only in the client it was issued to', async () => {
    const guard = new AuthGuard({
      verify: jest.fn().mockReturnValue({ sub: 1, azp: 'zhipath-web' }),
    } as any);
    const request = {
      headers: { authorization: 'Bearer valid' },
      requestContext: {
        requestId: 'request-1',
        clientApp: 'zhipath-web',
        clientVersion: 'test',
        startedAt: Date.now(),
      },
    };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user.azp', 'zhipath-web');
  });

  it('rejects access-token reuse by a different client', async () => {
    const guard = new AuthGuard({
      verify: jest.fn().mockReturnValue({ sub: 1, azp: 'zhipath-web' }),
    } as any);
    const request = {
      headers: { authorization: 'Bearer valid' },
      requestContext: {
        requestId: 'request-2',
        clientApp: 'codenova-web',
        clientVersion: 'test',
        startedAt: Date.now(),
      },
    };

    await expect(guard.canActivate(executionContext(request))).rejects.toThrow(
      new UnauthorizedException('访问令牌与当前客户端不匹配'),
    );
  });

  it('keeps legacy azp=unknown tokens compatible', async () => {
    const guard = new AuthGuard({
      verify: jest.fn().mockReturnValue({ sub: 1, azp: 'unknown' }),
    } as any);
    const request = {
      headers: { authorization: 'Bearer legacy' },
      requestContext: {
        requestId: 'request-3',
        clientApp: 'codenova-web',
        clientVersion: 'test',
        startedAt: Date.now(),
      },
    };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
  });
});
