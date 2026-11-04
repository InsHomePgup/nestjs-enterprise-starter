import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ErrorCode } from '../../../common/constants/error-code.enum';
import { ApiErrors } from '../../../common/swagger/api-errors.decorator';
import type { Role } from '../../../generated/prisma/enums';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Protects an endpoint (or a whole controller) and documents it in one go:
 *
 *   @Auth()             // any logged-in user
 *   @Auth(Role.ADMIN)   // logged-in user with one of the given roles
 *
 * Adds the guards, the Swagger bearer-auth marker and the error codes the guards can
 * produce, so the docs always match the actual behaviour.
 */
export function Auth(...roles: Role[]) {
  const decorators = [
    ApiBearerAuth(),
    ApiErrors(
      ErrorCode.AUTH_TOKEN_MISSING,
      ErrorCode.AUTH_TOKEN_EXPIRED,
      ErrorCode.AUTH_TOKEN_INVALID,
    ),
  ];
  if (roles.length === 0) {
    return applyDecorators(UseGuards(JwtAuthGuard), ...decorators);
  }
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiErrors(ErrorCode.AUTH_FORBIDDEN),
    ...decorators,
  );
}
