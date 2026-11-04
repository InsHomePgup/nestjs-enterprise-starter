import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '../../../common/constants/error-code.enum';
import { BusinessException } from '../../../common/exceptions/business.exception';

/**
 * Maps passport-jwt failures to precise error codes so clients can react correctly:
 * - AUTH_TOKEN_MISSING  -> no Authorization header: go to login
 * - AUTH_TOKEN_EXPIRED  -> call /auth/refresh, then replay the request
 * - AUTH_TOKEN_INVALID  -> malformed / bad signature: clear tokens, go to login
 */
export function resolveJwtFailure(info: unknown): ErrorCode {
  const name = (info as { name?: unknown } | null | undefined)?.name;
  const message = (info as { message?: unknown } | null | undefined)?.message;

  if (name === 'TokenExpiredError') {
    return ErrorCode.AUTH_TOKEN_EXPIRED;
  }
  if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
    return ErrorCode.AUTH_TOKEN_INVALID;
  }
  if (typeof message === 'string' && /no auth token/i.test(message)) {
    return ErrorCode.AUTH_TOKEN_MISSING;
  }
  return ErrorCode.AUTH_TOKEN_INVALID;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser | false, info: unknown): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new BusinessException(resolveJwtFailure(info));
    }
    return user;
  }
}
