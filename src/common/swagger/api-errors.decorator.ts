import { ApiExtension } from '@nestjs/swagger';
import type { ErrorCode } from '../constants/error-code.enum';

/** Final, merged list of error codes on each operation of the generated document. */
export const ERROR_CODES_EXTENSION = 'x-error-codes';
/** Prefix of the per-decorator extensions merged into ERROR_CODES_EXTENSION. */
export const ERROR_CODES_EXTENSION_PREFIX = 'x-error-codes-';

let sequence = 0;

/**
 * Declares which business error codes an endpoint (or every endpoint of a controller) can
 * return. The OpenAPI post-processor turns them into documented error responses, grouped
 * by HTTP status, each with an example body and the code's description.
 *
 * Can be stacked, on methods and controllers; all codes are merged:
 *
 *   @Auth()                                      // adds AUTH_TOKEN_* codes
 *   @ApiErrors(ErrorCode.USER_NOT_FOUND)
 *
 * Generic codes (validation, malformed JSON, rate limit, 500, 503) are added automatically
 * by the post-processor, so only list the codes specific to the endpoint here.
 */
export function ApiErrors(...codes: ErrorCode[]): ClassDecorator & MethodDecorator {
  // @nestjs/swagger keeps the FIRST value written for a given extension key, so stacked
  // decorators sharing one key would silently drop codes. Each call therefore gets its own
  // key; postProcessDocument() merges every `x-error-codes-*` key into `x-error-codes`.
  return ApiExtension(`${ERROR_CODES_EXTENSION_PREFIX}${++sequence}`, codes);
}
