import { ClsServiceManager, type ClsStore } from 'nestjs-cls';
import type { Role } from '../../generated/prisma/enums';

/**
 * Per-request context, available anywhere in the call chain without passing it around.
 *
 * - `requestId` is set for every HTTP request by the CLS middleware.
 * - `userId` / `userRole` are set once JWT authentication succeeds (see JwtStrategy);
 *   they stay undefined for anonymous requests.
 *
 * Inject `ClsService<RequestContextStore>` where DI is available, or use
 * `getRequestContext()` in plain functions (logger mixins, Prisma extensions...).
 */
export interface RequestContextStore extends ClsStore {
  requestId: string;
  userId?: string;
  userRole?: Role;
}

export interface RequestContextSnapshot {
  requestId?: string;
  userId?: string;
  userRole?: Role;
}

/** Returns the current request context, or an empty object outside of a request. */
export function getRequestContext(): RequestContextSnapshot {
  const cls = ClsServiceManager.getClsService<RequestContextStore>();
  if (!cls.isActive()) {
    return {};
  }
  return {
    requestId: cls.getId(),
    userId: cls.get('userId'),
    userRole: cls.get('userRole'),
  };
}
