import { ErrorCode } from '../../../common/constants/error-code.enum';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { JwtAuthGuard, resolveJwtFailure } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it.each([
    [{ name: 'TokenExpiredError', message: 'jwt expired' }, ErrorCode.AUTH_TOKEN_EXPIRED],
    [{ name: 'JsonWebTokenError', message: 'invalid signature' }, ErrorCode.AUTH_TOKEN_INVALID],
    [{ name: 'NotBeforeError', message: 'jwt not active' }, ErrorCode.AUTH_TOKEN_INVALID],
    [new Error('No auth token'), ErrorCode.AUTH_TOKEN_MISSING],
    [undefined, ErrorCode.AUTH_TOKEN_INVALID],
  ])('maps passport info %j to %s', (info, expected) => {
    expect(resolveJwtFailure(info)).toBe(expected);
  });

  it('throws a BusinessException with the resolved code when authentication fails', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, false, { name: 'TokenExpiredError' })).toThrow(
      expect.objectContaining({ code: ErrorCode.AUTH_TOKEN_EXPIRED }) as BusinessException,
    );
  });

  it('returns the user when authentication succeeds', () => {
    const user = { userId: 'u1' };
    expect(new JwtAuthGuard().handleRequest(null, user, undefined)).toBe(user);
  });
});
