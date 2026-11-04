import { HttpException } from '@nestjs/common';
import {
  ERROR_CODE_DEFINITIONS,
  type ErrorCode,
  type ErrorDetail,
} from '../constants/error-code.enum';

export interface BusinessExceptionOptions {
  /** Overrides the registry's default message (keep it user-safe: no internals). */
  message?: string;
  /** Field-level details, e.g. which field conflicts. */
  details?: ErrorDetail[];
  /** Underlying error, kept for logs only (never sent to the client). */
  cause?: unknown;
}

/**
 * The one exception type for expected, business-level failures.
 * HTTP status and default message come from ERROR_CODE_DEFINITIONS, so a code always maps
 * to the same status everywhere:
 *
 *   throw new BusinessException(ErrorCode.USER_NOT_FOUND);
 *   throw new BusinessException(ErrorCode.COMMON_CONFLICT, { details: [{ field: 'email', rule: 'unique', message: '...' }] });
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, options: BusinessExceptionOptions = {}) {
    const definition = ERROR_CODE_DEFINITIONS[code];
    const message = options.message ?? definition.message;
    super({ code, message, details: options.details }, definition.status, {
      cause: options.cause,
    });
    this.code = code;
    this.details = options.details;
  }
}
