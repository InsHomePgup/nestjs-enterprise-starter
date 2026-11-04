import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { ERROR_CODE_DEFINITIONS, ErrorCode } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';
import { AllExceptionsFilter, type ErrorResponseBody } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response: { status: jest.Mock; locals: Record<string, unknown>; err?: unknown } = {
    status,
    locals: {},
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/api/x', id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as ErrorResponseBody,
    response,
  };
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('AllExceptionsFilter', () => {
  describe('BusinessException', () => {
    it('uses status and default message from the registry', () => {
      const { status, body } = run(new BusinessException(ErrorCode.USER_NOT_FOUND));
      expect(status).toBe(404);
      expect(body).toMatchObject({
        statusCode: 404,
        code: ErrorCode.USER_NOT_FOUND,
        message: ERROR_CODE_DEFINITIONS[ErrorCode.USER_NOT_FOUND].message,
        error: 'Not Found',
        path: '/api/x',
        requestId: 'req-1',
      });
      expect(body.details).toBeUndefined();
    });

    it('passes through a custom message and details', () => {
      const details = [{ field: 'email', rule: 'unique', message: 'email already exists' }];
      const { body } = run(
        new BusinessException(ErrorCode.COMMON_CONFLICT, { message: 'Custom', details }),
      );
      expect(body).toMatchObject({ statusCode: 409, message: 'Custom', details });
    });
  });

  describe('framework exceptions', () => {
    it('derives a code from the status for plain HttpExceptions', () => {
      const { body } = run(new UnauthorizedException());
      expect(body).toMatchObject({ statusCode: 401, code: ErrorCode.COMMON_UNAUTHORIZED });
    });

    it('recognises unknown routes', () => {
      const { body } = run(new NotFoundException('Cannot GET /api/nope'));
      expect(body).toMatchObject({ statusCode: 404, code: ErrorCode.COMMON_ROUTE_NOT_FOUND });
    });

    it('keeps other 404s as COMMON_NOT_FOUND', () => {
      const { body } = run(new NotFoundException('Thing not found'));
      expect(body.code).toBe(ErrorCode.COMMON_NOT_FOUND);
    });

    it('maps throttling to COMMON_TOO_MANY_REQUESTS', () => {
      const { body } = run(new ThrottlerException());
      expect(body).toMatchObject({ statusCode: 429, code: ErrorCode.COMMON_TOO_MANY_REQUESTS });
    });

    it('keeps the descriptive message of pipe errors', async () => {
      const error = await new ParseUUIDPipe()
        .transform('not-a-uuid', { type: 'param' })
        .catch((e: unknown) => e);
      const { body } = run(error);
      expect(body).toMatchObject({
        statusCode: 400,
        code: ErrorCode.COMMON_VALIDATION_FAILED,
        message: expect.stringContaining('uuid'),
      });
    });
  });

  describe('body-parser errors', () => {
    it('maps malformed JSON', () => {
      const error = Object.assign(new SyntaxError('Unexpected token'), {
        type: 'entity.parse.failed',
        status: 400,
      });
      const { body } = run(error);
      expect(body).toMatchObject({ statusCode: 400, code: ErrorCode.COMMON_MALFORMED_JSON });
    });

    it('maps oversized payloads', () => {
      const error = Object.assign(new Error('too large'), { type: 'entity.too.large' });
      const { body } = run(error);
      expect(body).toMatchObject({ statusCode: 413, code: ErrorCode.COMMON_PAYLOAD_TOO_LARGE });
    });
  });

  describe('Prisma errors', () => {
    it('maps P2002 to 409 with the conflicting field (driver adapter shape)', () => {
      const { body } = run(
        prismaError('P2002', {
          driverAdapterError: { cause: { constraint: { fields: ['email'] } } },
        }),
      );
      expect(body).toMatchObject({
        statusCode: 409,
        code: ErrorCode.COMMON_CONFLICT,
        details: [{ field: 'email', rule: 'unique', message: 'email already exists' }],
      });
    });

    it('maps P2002 with the classic `target` shape', () => {
      const { body } = run(prismaError('P2002', { target: ['slug'] }));
      expect(body.details).toEqual([
        { field: 'slug', rule: 'unique', message: 'slug already exists' },
      ]);
    });

    it.each([
      ['P2003', 409, ErrorCode.COMMON_CONFLICT],
      ['P2025', 404, ErrorCode.COMMON_NOT_FOUND],
      ['P2000', 400, ErrorCode.COMMON_VALIDATION_FAILED],
    ])('maps %s to %i', (prismaCode, expectedStatus, expectedCode) => {
      const { status, body, response } = run(prismaError(prismaCode));
      expect(status).toBe(expectedStatus);
      expect(body.code).toBe(expectedCode);
      expect(response.err).toBeUndefined();
    });

    it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])(
      'maps connectivity error %s to 503 and logs it',
      (prismaCode) => {
        const { status, body, response } = run(prismaError(prismaCode));
        expect(status).toBe(503);
        expect(body.code).toBe(ErrorCode.COMMON_SERVICE_UNAVAILABLE);
        expect(response.err).toBeDefined();
      },
    );

    it('treats unmapped Prisma errors as 500', () => {
      const { status } = run(prismaError('P2010'));
      expect(status).toBe(500);
    });
  });

  describe('unknown errors and logging hooks', () => {
    it('hides unknown errors behind a generic 500 and hands the original to the access log', () => {
      const original = new Error('secret internals');
      const { status, body, response } = run(original);
      expect(status).toBe(500);
      expect(body).toMatchObject({
        code: ErrorCode.COMMON_INTERNAL_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      });
      expect(response.err).toBe(original);
      expect(JSON.stringify(body)).not.toContain('secret internals');
    });

    it('exposes the error code to the access log via res.locals', () => {
      const { response } = run(new UnauthorizedException());
      expect(response.locals.errorCode).toBe(ErrorCode.COMMON_UNAUTHORIZED);
      expect(response.err).toBeUndefined();
    });
  });
});
