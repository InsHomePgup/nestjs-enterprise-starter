import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import { parseDurationMs } from '../../common/utils/duration.util';
import type { Role } from '../../generated/prisma/enums';
import { UserRepository } from '../user/user.repository';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenRepository } from './token.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new BusinessException(
        ErrorCode.AUTH_EMAIL_TAKEN,
        'Email is already registered',
        HttpStatus.CONFLICT,
      );
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const user = await this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });

    return this.buildAuthResponse(user.id, user.email, user.name, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.buildAuthResponse(user.id, user.email, user.name, user.role);
  }

  async refresh(dto: RefreshTokenDto) {
    const existing = await this.tokenRepository.findValidRefreshToken(dto.refreshToken);
    if (!existing) {
      throw new BusinessException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Refresh token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.userRepository.findById(existing.userId);
    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Refresh token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.tokenRepository.revokeRefreshToken(existing.id);
    return this.buildAuthResponse(user.id, user.email, user.name, user.role);
  }

  async logout(dto: LogoutDto): Promise<void> {
    await this.tokenRepository.revokeRefreshTokenByRawToken(dto.refreshToken);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      return;
    }

    const ttlMs = this.configService.get<number>('auth.passwordResetExpiresMinutes', 30) * 60_000;
    const { token } = await this.tokenRepository.createPasswordResetToken(user.id, ttlMs);

    // TODO: replace with a real email provider integration. For now the reset
    // token is only surfaced via logs so it never appears in the HTTP response.
    this.logger.debug(`Password reset token for ${user.email}: ${token}`);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const resetToken = await this.tokenRepository.findValidPasswordResetToken(dto.token);
    if (!resetToken) {
      throw new BusinessException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Reset token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.userRepository.update(resetToken.userId, { password: hashedPassword });
    await this.tokenRepository.markPasswordResetTokenUsed(resetToken.id);
    await this.tokenRepository.revokeAllRefreshTokensForUser(resetToken.userId);
  }

  private async buildAuthResponse(id: string, email: string, name: string | null, role: Role) {
    const accessToken = this.jwtService.sign({ sub: id, email, role });
    const refreshTtlMs = parseDurationMs(
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d',
    );
    const { token: refreshToken } = await this.tokenRepository.createRefreshToken(id, refreshTtlMs);

    return {
      accessToken,
      refreshToken,
      user: { id, email, name, role },
    };
  }
}
