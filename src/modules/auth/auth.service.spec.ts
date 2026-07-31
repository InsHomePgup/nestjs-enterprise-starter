import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../user/user.repository';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    configService = { get: jest.fn().mockReturnValue(10) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns an access token when the email is not taken', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        name: 'Alice',
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
        user: { id: 'user-1', email: 'a@example.com', name: 'Alice' },
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          email: 'a@example.com',
          password: 'plain-password',
        }),
      ).rejects.toThrow(ConflictException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns an access token when credentials are valid', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        password: 'hashed-password',
        name: 'Alice',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'a@example.com',
        password: 'plain-password',
      });

      expect(result).toEqual({
        accessToken: 'signed-jwt',
        user: { id: 'user-1', email: 'a@example.com', name: 'Alice' },
      });
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'missing@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        password: 'hashed-password',
        name: 'Alice',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'a@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
