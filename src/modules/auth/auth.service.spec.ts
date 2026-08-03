import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { BusinessException } from '../../common/exceptions/business.exception';
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
    findValidRefreshToken: jest.Mock;
    revokeRefreshToken: jest.Mock;
    revokeRefreshTokenByRawToken: jest.Mock;
    revokeAllRefreshTokensForUser: jest.Mock;
    createPasswordResetToken: jest.Mock;
    findValidPasswordResetToken: jest.Mock;
    markPasswordResetTokenUsed: jest.Mock;
  };
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
      findValidRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeRefreshTokenByRawToken: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn(),
      createPasswordResetToken: jest.fn().mockResolvedValue({ token: 'raw-reset-token' }),
      findValidPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
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
      tokenRepository.findValidRefreshToken.mockResolvedValue({
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

      expect(tokenRepository.revokeRefreshToken).toHaveBeenCalledWith('token-1');
      expect(result.refreshToken).toBe('raw-refresh-token');
    });

    it('throws BusinessException when the refresh token is invalid or expired', async () => {
      tokenRepository.findValidRefreshToken.mockResolvedValue(null);

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
    it('updates the password and revokes existing sessions', async () => {
      tokenRepository.findValidPasswordResetToken.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.resetPassword({ token: 'raw-reset-token', newPassword: 'new-password123' });

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        password: 'new-hashed-password',
      });
      expect(tokenRepository.markPasswordResetTokenUsed).toHaveBeenCalledWith('reset-1');
      expect(tokenRepository.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1');
    });

    it('throws BusinessException when the reset token is invalid or expired', async () => {
      tokenRepository.findValidPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'new-password123' }),
      ).rejects.toThrow(BusinessException);
    });
  });
});
