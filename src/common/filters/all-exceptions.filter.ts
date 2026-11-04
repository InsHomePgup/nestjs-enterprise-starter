import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ERROR_CODE_LOCAL } from '../../infra/logger/logger.options';
import { ERROR_CODE_DEFINITIONS, ErrorCode, type ErrorDetail } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';
import { mapPrismaError } from './prisma-error.mapper';

/** Shape of every error response body. Mirrored by `ErrorResponseDto` for Swagger. */
export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  /** Field-level problems (validation failures, unique conflicts...), when available. */
  details?: ErrorDetail[];
  /** HTTP reason phrase, e.g. "Bad Request". */
  error: string;
  path: string;
  requestId: string | undefined;
  timestamp: string;
}

interface NormalizedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

/** Fallback code for framework HttpExceptions that carry no business code. */
const DEFAULT_CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_VALIDATION_FAILED,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.COMMON_VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.COMMON_UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.COMMON_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.COMMON_CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.COMMON_PAYLOAD_TOO_LARGE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.COMMON_TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.COMMON_SERVICE_UNAVAILABLE,
};

function defaultCodeFor(statusCode: number): ErrorCode {
  return (
    DEFAULT_CODE_BY_STATUS[statusCode] ??
    (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
      ? ErrorCode.COMMON_INTERNAL_ERROR
      : ErrorCode.COMMON_BAD_REQUEST)
  );
}

function fromRegistry(code: ErrorCode, overrides: Partial<NormalizedError> = {}): NormalizedError {
  const { status, message } = ERROR_CODE_DEFINITIONS[code];
  return { statusCode: status, code, message, ...overrides };
}

/** Express's router throws `Cannot GET /x` NotFoundExceptions for unknown routes. */
function isRouteNotFound(exception: HttpException): boolean {
  if (!(exception instanceof NotFoundException)) {
    return false;
  }
  const response = exception.getResponse();
  const message =
    typeof response === 'object' && response !== null
      ? (response as { message?: unknown }).message
      : response;
  return typeof message === 'string' && /^Cannot [A-Z]+ /.test(message);
}

/**
 * Raw body-parser errors (http-errors objects). Normally createJsonBodyParser already turns
 * them into BusinessExceptions; this is a fallback for other parsers (e.g. urlencoded).
 */
function normalizeBodyParserError(exception: unknown): NormalizedError | undefined {
  const type = (exception as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') {
    return fromRegistry(ErrorCode.COMMON_MALFORMED_JSON);
  }
  if (type === 'entity.too.large') {
    return fromRegistry(ErrorCode.COMMON_PAYLOAD_TOO_LARGE);
  }
  return undefined;
}

function normalizeHttpException(exception: HttpException): NormalizedError {
  const statusCode = exception.getStatus();

  if (isRouteNotFound(exception)) {
    return fromRegistry(ErrorCode.COMMON_ROUTE_NOT_FOUND);
  }
  if (exception instanceof ThrottlerException) {
    return fromRegistry(ErrorCode.COMMON_TOO_MANY_REQUESTS);
  }

  // Framework exceptions (ParseUUIDPipe, etc.): keep their message for 4xx since it is
  // descriptive and safe; hide it for 5xx.
  const code = defaultCodeFor(statusCode);
  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return fromRegistry(code, { statusCode });
  }
  const response = exception.getResponse();
  const rawMessage =
    typeof response === 'string' ? response : (response as { message?: unknown }).message;
  return {
    statusCode,
    code,
    message: typeof rawMessage === 'string' ? rawMessage : ERROR_CODE_DEFINITIONS[code].message,
    ...(Array.isArray(rawMessage)
      ? { details: rawMessage.map((m) => ({ message: String(m) })) }
      : {}),
  };
}

export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof BusinessException) {
    const response = exception.getResponse() as { message: string };
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: response.message,
      ...(exception.details?.length ? { details: exception.details } : {}),
    };
  }
  if (exception instanceof HttpException) {
    return normalizeHttpException(exception);
  }

  const bodyParserError = normalizeBodyParserError(exception);
  if (bodyParserError) {
    return bodyParserError;
  }

  const prismaError = mapPrismaError(exception);
  if (prismaError) {
    return prismaError;
  }

  return fromRegistry(ErrorCode.COMMON_INTERNAL_ERROR);
}

/**
 * Turns every exception into the unified error body.
 *
 * Logging is delegated to the pino-http access log (one line per request): the filter only
 * attaches the error code (and, for 5xx, the original exception with its stack) to the
 * response, and pino-http writes them out together with requestId / userId / timing.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response & { err?: unknown }>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const normalized = normalizeException(exception);
    const body: ErrorResponseBody = {
      ...normalized,
      error: STATUS_CODES[normalized.statusCode] ?? 'Error',
      path: request.url,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };

    response.locals[ERROR_CODE_LOCAL] = body.code;
    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // pino-http logs `res.err` (message + stack) on the access-log line.
      response.err = exception instanceof Error ? exception : new Error(String(exception));
    }

    response.status(body.statusCode).json(body);
  }
}
