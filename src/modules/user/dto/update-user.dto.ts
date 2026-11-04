import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

/** 更新用户请求；只传需要修改的字段 */
export class UpdateUserDto {
  /**
   * 昵称
   * @example "Alice"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** 角色 */
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
