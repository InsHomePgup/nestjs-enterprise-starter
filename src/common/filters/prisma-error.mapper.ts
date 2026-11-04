import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ERROR_CODE_DEFINITIONS, ErrorCode, type ErrorDetail } from '../constants/error-code.enum';

export interface MappedPrismaError {
  statusCode: HttpStatus;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

/** Connection / availability problems: the DB is down or overloaded, not a code bug. */
const UNAVAILABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server closed the connection
  'P2024', // Timed out fetching a connection from the pool
]);

function fromRegistry(code: ErrorCode, details?: ErrorDetail[]): MappedPrismaError {
  const { status, message } = ERROR_CODE_DEFINITIONS[code];
  return { statusCode: status, code, message, ...(details ? { details } : {}) };
}

/**
 * Extracts the columns of a violated unique constraint. With driver adapters (Prisma 7)
 * they live in `meta.driverAdapterError.cause.constraint.fields`; the classic engine
 * reports them in `meta.target`.
 */
export function getUniqueConstraintFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) {
    return adapterFields.map(String);
  }
  if (Array.isArray(meta?.target)) {
    return meta.target.map(String);
  }
  return [];
}

/**
 * Translates well-known Prisma errors into API errors so that, for example, a unique
 * constraint race surfaces as 409 (with the conflicting field) and a dead database as 503,
 * instead of a generic 500. Returns `undefined` for anything that should stay a 500.
 *
 * Reference: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(exception: unknown): MappedPrismaError | undefined {
  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return fromRegistry(ErrorCode.COMMON_SERVICE_UNAVAILABLE);
  }
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }
  if (UNAVAILABLE_CODES.has(exception.code)) {
    return fromRegistry(ErrorCode.COMMON_SERVICE_UNAVAILABLE);
  }

  switch (exception.code) {
    case 'P2002': {
      // Unique constraint failed
      const details = getUniqueConstraintFields(exception).map((field) => ({
        field,
        rule: 'unique',
        message: `${field} already exists`,
      }));
      return fromRegistry(ErrorCode.COMMON_CONFLICT, details.length ? details : undefined);
    }
    case 'P2003': // Foreign key constraint failed
      return {
        ...fromRegistry(ErrorCode.COMMON_CONFLICT),
        message: 'Operation conflicts with related resources',
      };
    case 'P2025': // Record required but not found
      return fromRegistry(ErrorCode.COMMON_NOT_FOUND);
    case 'P2000': // Value too long for column
      return {
        ...fromRegistry(ErrorCode.COMMON_VALIDATION_FAILED),
        message: 'Input value is too long',
      };
    default:
      return undefined;
  }
}

/** True when `error` is a Prisma unique-constraint violation (P2002). */
export function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** True when an update/delete matched no record (P2025). */
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
