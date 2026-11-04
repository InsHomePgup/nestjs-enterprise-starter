import type { ValidationError } from 'class-validator';
import { ErrorCode, type ErrorDetail } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';

/**
 * Flattens class-validator's nested error tree into `{ field, rule, message }` entries.
 * Nested objects / arrays produce dotted paths: `address.city`, `items.0.price`.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath?: string,
): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    for (const [rule, message] of Object.entries(error.constraints ?? {})) {
      details.push({ field, rule, message });
    }
    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }
  return details;
}

/** `exceptionFactory` for the global ValidationPipe: structured, field-level details. */
export function validationExceptionFactory(errors: ValidationError[]): BusinessException {
  return new BusinessException(ErrorCode.COMMON_VALIDATION_FAILED, {
    details: flattenValidationErrors(errors),
  });
}
