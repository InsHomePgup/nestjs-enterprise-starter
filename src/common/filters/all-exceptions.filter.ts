import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ErrorCode } from '../constants/error-code.enum';
import { mapPrismaError } from './prisma-error.mapper';

/** Shape of every error response body. Keep in sync with the Swagger error schema. */
export interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  /** Field-level validation messages (from ValidationPipe), when available. */
  details?: string[];
  error: string;
  path: string;
  requestId: string | undefined;
  timestamp: string;
}

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  error: string;
}

const DEFAULT_CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_VALIDATION_FAILED,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.COMMON_VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.COMMON_UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.COMMON_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.COMMON_CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.COMMON_TOO_MANY_REQUESTS,
};

function defaultCodeFor(statusCode: number): ErrorCode {
  const mapped = DEFAULT_CODE_BY_STATUS[statusCode];
  if (mapped) {
    return mapped;
  }
  return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
    ? ErrorCode.COMMON_INTERNAL_ERROR
    : ErrorCode.COMMON_BAD_REQUEST;
}

function normalizeHttpException(exception: HttpException): NormalizedError {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();

  let code: string | undefined;
  let message: string = exception.message;
  let details: string[] | undefined;

  if (typeof response === 'string') {
    message = response;
  } else if (typeof response === 'object' && response !== null) {
    const body = response as { code?: unknown; message?: unknown };
    if (typeof body.code === 'string') {
      code = body.code;
    }
    if (typeof body.message === 'string') {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      // ValidationPipe puts the per-field messages in an array.
      details = body.message.map(String);
      message = 'Validation failed';
    }
  }

  return {
    statusCode,
    code: code ?? defaultCodeFor(statusCode),
    message,
    ...(details ? { details } : {}),
    error: exception.name,
  };
}

function normalize(exception: unknown): NormalizedError {
  if (exception instanceof HttpException) {
    return normalizeHttpException(exception);
  }

  const prismaError = mapPrismaError(exception);
  if (prismaError) {
    return { ...prismaError, error: 'DatabaseError' };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.COMMON_INTERNAL_ERROR,
    message: 'Internal server error',
    error: 'InternalServerError',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const normalized = normalize(exception);
    const body: ErrorResponseBody = {
      ...normalized,
      path: request.url,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };

    const logMessage = `${request.method} ${request.url} -> ${body.statusCode} ${body.code}`;
    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(body.statusCode).json(body);
  }
}
