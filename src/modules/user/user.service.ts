import { Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildPaginationMeta } from '../../common/utils/pagination.util';
import type { Prisma } from '../../generated/prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { toUserResponse, UserResponseDto } from './dto/user-response.dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(query: UserQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.email ? { email: { contains: query.email, mode: 'insensitive' } } : {}),
      ...(query.role ? { role: query.role } : {}),
    };

    const [users, total] = await Promise.all([
      this.userRepository.findMany({
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        where,
      }),
      this.userRepository.count(where),
    ]);

    return {
      items: users.map(toUserResponse),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new BusinessException(ErrorCode.USER_NOT_FOUND);
    }
    return toUserResponse(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findOne(id);
    const user = await this.userRepository.update(id, dto);
    return toUserResponse(user);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userRepository.delete(id);
  }
}
