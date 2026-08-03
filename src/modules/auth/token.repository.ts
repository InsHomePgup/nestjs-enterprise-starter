import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PasswordResetToken, RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

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

  findValidRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  revokeRefreshTokenByRawToken(token: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
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

  findValidPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  markPasswordResetTokenUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
