import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  it('uses the v1 error contract and preserves request identity', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const request: any = {
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      requestContext: {
        requestId: 'req-v1',
        clientApp: 'codenova-web',
        clientVersion: 'dev',
        startedAt: Date.now(),
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(new BadRequestException('参数错误'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'REQUEST_INVALID',
        message: '参数错误',
        details: [],
        requestId: 'req-v1',
      },
      meta: { requestId: 'req-v1', clientApp: 'codenova-web' },
    });
  });
});
