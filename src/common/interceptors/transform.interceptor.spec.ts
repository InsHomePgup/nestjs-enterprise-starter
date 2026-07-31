import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let reflector: { getAllAndOverride: jest.Mock };

  const createContext = (): ExecutionContext => {
    const request = { url: '/orders', id: 'req-1' };
    const response = { statusCode: 200 };
    return {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const createCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new TransformInterceptor(reflector as unknown as Reflector);
  });

  it('wraps the response in a consistent envelope', (done) => {
    reflector.getAllAndOverride.mockReturnValue(false);

    interceptor.intercept(createContext(), createCallHandler({ id: 1 })).subscribe((result) => {
      expect(result).toEqual({
        statusCode: 200,
        data: { id: 1 },
        path: '/orders',
        requestId: 'req-1',
        timestamp: expect.any(String),
      });
      done();
    });
  });

  it('skips wrapping when @SkipResponseTransform is set', (done) => {
    reflector.getAllAndOverride.mockReturnValue(true);

    interceptor
      .intercept(createContext(), createCallHandler({ status: 'ok' }))
      .subscribe((result) => {
        expect(result).toEqual({ status: 'ok' });
        done();
      });
  });
});
