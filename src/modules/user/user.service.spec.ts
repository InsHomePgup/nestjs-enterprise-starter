import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from '../../common/exceptions/business.exception';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: {
    findMany: jest.Mock;
    count: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const user = {
    id: 'user-1',
    email: 'a@example.com',
    password: 'hashed',
    name: 'Alice',
    role: 'USER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    userRepository = {
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: UserRepository, useValue: userRepository }],
    }).compile();

    service = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns a paginated result without leaking passwords', async () => {
      userRepository.findMany.mockResolvedValue([user]);
      userRepository.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(userRepository.findMany).toHaveBeenCalledWith({ skip: 0, take: 20, where: {} });
      expect(result.items).toEqual([
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      ]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('applies email and role filters', async () => {
      userRepository.findMany.mockResolvedValue([]);
      userRepository.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10, email: 'a', role: 'ADMIN' as never });

      expect(userRepository.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        where: { email: { contains: 'a', mode: 'insensitive' }, role: 'ADMIN' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      userRepository.findById.mockResolvedValue(user);

      const result = await service.findOne('user-1');

      expect(result.id).toBe('user-1');
      expect(result).not.toHaveProperty('password');
    });

    it('throws BusinessException when not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('updates and returns the mapped user', async () => {
      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue({ ...user, name: 'Bob' });

      const result = await service.update('user-1', { name: 'Bob' });

      expect(userRepository.update).toHaveBeenCalledWith('user-1', { name: 'Bob' });
      expect(result.name).toBe('Bob');
    });

    it('throws BusinessException when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'Bob' })).rejects.toThrow(BusinessException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing user', async () => {
      userRepository.findById.mockResolvedValue(user);

      await service.remove('user-1');

      expect(userRepository.delete).toHaveBeenCalledWith('user-1');
    });

    it('throws BusinessException when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(BusinessException);
      expect(userRepository.delete).not.toHaveBeenCalled();
    });
  });
});
