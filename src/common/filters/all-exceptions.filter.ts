import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ErrorCode } from '../constants/error-code.enum';

const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

function resolveErrorCode(statusCode: number, response: unknown): string {
  if (typeof response === 'object' && response !== null && 'code' in response) {
    const code = (response as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  if (statusCode === HttpStatus.NOT_FOUND) {
    return ErrorCode.COMMON_NOT_FOUND;
  }
  if (statusCode >= HttpStatus.BAD_REQUEST && statusCode < INTERNAL_SERVER_ERROR_STATUS) {
    return ErrorCode.COMMON_VALIDATION_FAILED;
  }
  return ErrorCode.COMMON_INTERNAL_ERROR;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException ? exception.getResponse() : 'Internal server error';

    const errorBody = {
      statusCode,
      code: resolveErrorCode(statusCode, isHttpException ? exception.getResponse() : undefined),
      message,
      error: isHttpException ? exception.name : 'InternalServerError',
      path: request.url,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };

    const logMessage = `${request.method} ${request.url} -> ${statusCode}`;
    if (statusCode >= INTERNAL_SERVER_ERROR_STATUS) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(statusCode).json(errorBody);
  }
}
