import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { BusinessException } from '../../common/exceptions/business.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UserRepository } from '../user/user.repository';
import { AuthService } from './auth.service';
import { TokenRepository } from './token.repository';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let tokenRepository: {
    createRefreshToken: jest.Mock;
    consumeRefreshToken: jest.Mock;
    revokeRefreshTokenByRawToken: jest.Mock;
    revokeAllRefreshTokensForUser: jest.Mock;
    createPasswordResetToken: jest.Mock;
    findValidPasswordResetToken: jest.Mock;
    consumePasswordResetToken: jest.Mock;
  };
  const tx = { __tx: true };
  let prisma: { $transaction: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };
  let logger: { debug: jest.Mock };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    tokenRepository = {
      createRefreshToken: jest.fn().mockResolvedValue({ token: 'raw-refresh-token' }),
      consumeRefreshToken: jest.fn(),
      revokeRefreshTokenByRawToken: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn(),
      createPasswordResetToken: jest.fn().mockResolvedValue({ token: 'raw-reset-token' }),
      findValidPasswordResetToken: jest.fn(),
      consumePasswordResetToken: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(tx)),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.refreshExpiresIn') return '7d';
        return 10;
      }),
    };
    logger = { debug: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: TokenRepository, useValue: tokenRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns tokens when the email is not taken', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        name: 'Alice',
        role: 'USER',
      });

      const result = await service.register({
        email: 'a@example.com',
        password: 'plain-password',
        name: 'Alice',
      });

      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'a@example.com',
        password: 'hashed-password',
        name: 'Alice',
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt',
        refreshToken: 'raw-refresh-token',
        user: { id: 'user-1', email: 'a@example.com', name: 'Alice', role: 'USER' },
      });
    });

    it('throws BusinessException when the email is already registered', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          email: 'a@example.com',
          password: 'plain-password',
        }),
      ).rejects.toThrow(BusinessException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique-constraint violation to AUTH_EMAIL_TAKEN', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(
        service.register({ email: 'a@example.com', password: 'plain-password' }),
      ).rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_TAKEN' } });
    });
  });

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        password: 'hashed-password',
        name: 'Alice',
        role: 'USER',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'a@example.com',
        password: 'plain-password',
      });

      expect(result).toEqual({
        accessToken: 'signed-jwt',
        refreshToken: 'raw-refresh-token',
        user: { id: 'user-1', email: 'a@example.com', name: 'Alice', role: 'USER' },
      });
    });

    it('throws BusinessException when the user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'missing@example.com', password: 'x' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('throws BusinessException when the password does not match', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        password: 'hashed-password',
        name: 'Alice',
        role: 'USER',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'a@example.com', password: 'wrong' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      tokenRepository.consumeRefreshToken.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
      });
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        name: 'Alice',
        role: 'USER',
      });

      const result = await service.refresh({ refreshToken: 'old-refresh-token' });

      expect(tokenRepository.consumeRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(result.refreshToken).toBe('raw-refresh-token');
    });

    it('throws BusinessException when the refresh token is invalid or expired', async () => {
      tokenRepository.consumeRefreshToken.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'bad-token' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the given refresh token', async () => {
      await service.logout({ refreshToken: 'some-token' });

      expect(tokenRepository.revokeRefreshTokenByRawToken).toHaveBeenCalledWith('some-token');
    });
  });

  describe('forgotPassword', () => {
    it('issues a reset token and logs it when the user exists', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });

      await service.forgotPassword({ email: 'a@example.com' });

      expect(tokenRepository.createPasswordResetToken).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('does nothing observable when the user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await service.forgotPassword({ email: 'missing@example.com' });

      expect(tokenRepository.createPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('spends the token, updates the password and revokes sessions in one transaction', async () => {
      tokenRepository.findValidPasswordResetToken.mockResolvedValue({ id: 'reset-1' });
      tokenRepository.consumePasswordResetToken.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.resetPassword({ token: 'raw-reset-token', newPassword: 'new-password123' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tokenRepository.consumePasswordResetToken).toHaveBeenCalledWith('raw-reset-token', tx);
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        { password: 'new-hashed-password' },
        tx,
      );
      expect(tokenRepository.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1', tx);
    });

    it('throws without hashing when the reset token is invalid or expired', async () => {
      tokenRepository.findValidPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'new-password123' }),
      ).rejects.toThrow(BusinessException);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rolls back when the token was spent concurrently after the pre-check', async () => {
      tokenRepository.findValidPasswordResetToken.mockResolvedValue({ id: 'reset-1' });
      tokenRepository.consumePasswordResetToken.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await expect(
        service.resetPassword({ token: 'raw-reset-token', newPassword: 'new-password123' }),
      ).rejects.toThrow(BusinessException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });
});
