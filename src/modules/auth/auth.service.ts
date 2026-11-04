import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import { isUniqueConstraintError } from '../../common/filters/prisma-error.mapper';
import { parseDurationMs } from '../../common/utils/duration.util';
import type { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UserRepository } from '../user/user.repository';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenRepository } from './token.repository';

function emailTaken() {
  return new BusinessException(
    ErrorCode.AUTH_EMAIL_TAKEN,
    'Email is already registered',
    HttpStatus.CONFLICT,
  );
}

function invalidToken(kind: 'Refresh' | 'Reset') {
  return new BusinessException(
    ErrorCode.AUTH_TOKEN_INVALID,
    `${kind} token is invalid or expired`,
    HttpStatus.UNAUTHORIZED,
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw emailTaken();
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const user = await this.userRepository
      .create({ email: dto.email, password: hashedPassword, name: dto.name })
      .catch((error: unknown) => {
        // Lost a race with a concurrent registration of the same email.
        throw isUniqueConstraintError(error) ? emailTaken() : error;
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
    // Rotation: the presented token is revoked atomically; a replayed or concurrently
    // reused token gets null here and is rejected.
    const consumed = await this.tokenRepository.consumeRefreshToken(dto.refreshToken);
    if (!consumed) {
      throw invalidToken('Refresh');
    }

    const user = await this.userRepository.findById(consumed.userId);
    if (!user) {
      throw invalidToken('Refresh');
    }

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
    // Cheap pre-check so invalid tokens don't cost a bcrypt hash.
    if (!(await this.tokenRepository.findValidPasswordResetToken(dto.token))) {
      throw invalidToken('Reset');
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    // Spend the token, change the password and kill existing sessions all-or-nothing.
    await this.prisma.$transaction(async (tx) => {
      const consumed = await this.tokenRepository.consumePasswordResetToken(dto.token, tx);
      if (!consumed) {
        throw invalidToken('Reset');
      }
      await this.userRepository.update(consumed.userId, { password: hashedPassword }, tx);
      await this.tokenRepository.revokeAllRefreshTokensForUser(consumed.userId, tx);
    });
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
