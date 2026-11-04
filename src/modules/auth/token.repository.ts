import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { isRecordNotFoundError } from '../../common/filters/prisma-error.mapper';
import type { PasswordResetToken, Prisma, RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/** Either the root client or an interactive-transaction client. */
type Db = Prisma.TransactionClient;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private issue(ttlMs: number): IssuedToken {
    return {
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }

  async createRefreshToken(userId: string, ttlMs: number): Promise<IssuedToken> {
    const issued = this.issue(ttlMs);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(issued.token), expiresAt: issued.expiresAt },
    });
    return issued;
  }

  /**
   * Atomically marks a valid (unrevoked, unexpired) refresh token as revoked and returns it.
   * Implemented as a single conditional UPDATE, so of two concurrent calls with the same
   * token exactly one succeeds; the other gets `null`.
   */
  async consumeRefreshToken(token: string, db: Db = this.prisma): Promise<RefreshToken | null> {
    try {
      return await db.refreshToken.update({
        where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  revokeRefreshTokenByRawToken(token: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokensForUser(userId: string, db: Db = this.prisma): Promise<{ count: number }> {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createPasswordResetToken(userId: string, ttlMs: number): Promise<IssuedToken> {
    const issued = this.issue(ttlMs);
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(issued.token), expiresAt: issued.expiresAt },
    });
    return issued;
  }

  /** Read-only validity check; use `consumePasswordResetToken` to actually spend it. */
  findValidPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** Atomically marks a valid reset token as used and returns it, or `null` if already spent. */
  async consumePasswordResetToken(
    token: string,
    db: Db = this.prisma,
  ): Promise<PasswordResetToken | null> {
    try {
      return await db.passwordResetToken.update({
        where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }
}
