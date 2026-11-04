import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Role } from '../../../generated/prisma/enums';

/** 用户列表查询参数 */
export class UserQueryDto extends PaginationQueryDto {
  /**
   * 按邮箱模糊搜索（不区分大小写）
   * @example "alice"
   */
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  /** 按角色筛选 */
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
