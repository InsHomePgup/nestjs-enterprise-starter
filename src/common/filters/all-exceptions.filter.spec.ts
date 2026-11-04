import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { Logger } from 'nestjs-pino';
import { Prisma } from '../../generated/prisma/client';
import { ErrorCode } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';
import { AllExceptionsFilter, type ErrorResponseBody } from './all-exceptions.filter';

function run(exception: unknown) {
  const logger = { error: jest.fn(), warn: jest.fn() } as unknown as Logger;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/api/x', id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter(logger).catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as ErrorResponseBody,
    logger,
  };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });
}

describe('AllExceptionsFilter', () => {
  it('keeps the business code and flattens the message', () => {
    const { status, body } = run(
      new BusinessException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND),
    );
    expect(status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      code: ErrorCode.USER_NOT_FOUND,
      message: 'User not found',
      path: '/api/x',
      requestId: 'req-1',
    });
    expect(body.details).toBeUndefined();
  });

  it('moves ValidationPipe messages into details', () => {
    const { status, body } = run(new BadRequestException(['email must be an email']));
    expect(status).toBe(400);
    expect(body).toMatchObject({
      code: ErrorCode.COMMON_VALIDATION_FAILED,
      message: 'Validation failed',
      details: ['email must be an email'],
    });
  });

  it('derives a code from the status for plain HttpExceptions', () => {
    const { body } = run(new UnauthorizedException());
    expect(body).toMatchObject({ statusCode: 401, code: ErrorCode.COMMON_UNAUTHORIZED });
  });

  it.each([
    ['P2002', 409, ErrorCode.COMMON_CONFLICT],
    ['P2003', 409, ErrorCode.COMMON_CONFLICT],
    ['P2025', 404, ErrorCode.COMMON_NOT_FOUND],
    ['P2000', 400, ErrorCode.COMMON_VALIDATION_FAILED],
  ])('maps Prisma %s to %i', (prismaCode, expectedStatus, expectedCode) => {
    const { status, body, logger } = run(prismaError(prismaCode));
    expect(status).toBe(expectedStatus);
    expect(body.code).toBe(expectedCode);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('hides unknown errors behind a generic 500 and logs them', () => {
    const { status, body, logger } = run(new Error('secret internals'));
    expect(status).toBe(500);
    expect(body).toMatchObject({
      code: ErrorCode.COMMON_INTERNAL_ERROR,
      message: 'Internal server error',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('treats unmapped Prisma errors as 500', () => {
    const { status } = run(prismaError('P1001'));
    expect(status).toBe(500);
  });
});
