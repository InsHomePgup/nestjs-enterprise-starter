import { ApiProperty } from '@nestjs/swagger';
import { Paginated } from '../../../common/dto/api-response.dto';
import type { User } from '../../../generated/prisma/client';
import { Role } from '../../../generated/prisma/enums';

/** 用户信息（不含密码等敏感字段） */
export class UserResponseDto {
  /**
   * 用户 ID（UUID）
   * @example "c658fdbb-475d-4e4b-ae5d-ba630e31c797"
   */
  id: string;

  /**
   * 邮箱（登录账号）
   * @example "alice@example.com"
   */
  email: string;

  /**
   * 昵称；未设置时为 null
   * @example "Alice"
   */
  name: string | null;

  /** 角色：USER 普通用户，ADMIN 管理员 */
  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.USER })
  role: Role;

  /** 创建时间（ISO 8601） */
  createdAt: Date;

  /** 最后更新时间（ISO 8601） */
  updatedAt: Date;
}

/** 用户分页列表 */
export class UserPageDto extends Paginated(UserResponseDto) {}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
