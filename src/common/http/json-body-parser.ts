import { json, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { ErrorCode } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';

/** Default max JSON body size. Override with BODY_LIMIT (e.g. "1mb"). */
export const DEFAULT_BODY_LIMIT = '100kb';

/**
 * JSON body parser that reports failures with precise error codes.
 *
 * Nest's built-in parser turns body-parser errors into a bare `BadRequestException(message)`,
 * losing the error type. Registered before Nest's own parser (which then skips already-parsed
 * bodies), this one converts them into BusinessExceptions:
 *   - invalid JSON          -> COMMON_MALFORMED_JSON (400)
 *   - body over the limit   -> COMMON_PAYLOAD_TOO_LARGE (413)
 */
export function createJsonBodyParser(limit: string = DEFAULT_BODY_LIMIT): RequestHandler {
  const parser = json({ limit });
  return (req: Request, res: Response, next: NextFunction) => {
    parser(req, res, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }
      const type = (error as { type?: unknown }).type;
      if (type === 'entity.parse.failed') {
        next(new BusinessException(ErrorCode.COMMON_MALFORMED_JSON, { cause: error }));
      } else if (type === 'entity.too.large') {
        next(
          new BusinessException(ErrorCode.COMMON_PAYLOAD_TOO_LARGE, {
            message: `Payload too large (limit ${limit})`,
            cause: error,
          }),
        );
      } else {
        next(error);
      }
    });
  };
}
