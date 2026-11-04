import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ErrorCode } from '../constants/error-code.enum';

export interface MappedPrismaError {
  statusCode: HttpStatus;
  code: ErrorCode;
  message: string;
}

/**
 * Translates well-known Prisma errors into HTTP-friendly errors so that, for example,
 * a unique-constraint race surfaces as 409 instead of a generic 500.
 * Returns `undefined` for anything that should stay a 500.
 *
 * Reference: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(exception: unknown): MappedPrismaError | undefined {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }

  switch (exception.code) {
    case 'P2002': // Unique constraint failed
      return {
        statusCode: HttpStatus.CONFLICT,
        code: ErrorCode.COMMON_CONFLICT,
        message: 'Resource already exists',
      };
    case 'P2003': // Foreign key constraint failed
      return {
        statusCode: HttpStatus.CONFLICT,
        code: ErrorCode.COMMON_CONFLICT,
        message: 'Operation conflicts with related resources',
      };
    case 'P2025': // Record required but not found
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: ErrorCode.COMMON_NOT_FOUND,
        message: 'Resource not found',
      };
    case 'P2000': // Value too long for column
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.COMMON_VALIDATION_FAILED,
        message: 'Input value is too long',
      };
    default:
      return undefined;
  }
}

/** True when `error` is a Prisma unique-constraint violation (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** True when an update/delete matched no record (P2025). */
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
