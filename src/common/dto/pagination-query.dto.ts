import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** 通用分页参数；列表查询 DTO 继承它即可 */
export class PaginationQueryDto {
  /**
   * 页码，从 1 开始
   * @example 1
   */
  @ApiPropertyOptional({ type: 'integer', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  /**
   * 每页条数，最大 100
   * @example 20
   */
  @ApiPropertyOptional({ type: 'integer', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;
}
