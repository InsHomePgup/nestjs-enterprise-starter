import { type Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from '../constants/error-code.enum';

/** 字段级错误明细 */
export class ErrorDetailDto {
  /**
   * 出错字段的点分路径；嵌套对象 / 数组形如 `address.city`、`items.0.price`
   * @example "email"
   */
  field?: string;

  /**
   * 未通过的规则名，如 `isEmail`、`minLength`、`unique`
   * @example "isEmail"
   */
  rule?: string;

  /**
   * 错误描述（英文）
   * @example "email must be an email"
   */
  message: string;
}

/** 统一错误响应体。所有 4xx / 5xx 响应都使用该结构，前端以 `code` 作为分支依据 */
export class ErrorResponseDto {
  /**
   * HTTP 状态码，与响应状态一致
   * @example 400
   */
  @ApiProperty({ type: 'integer' })
  statusCode: number;

  /** 业务错误码，完整列表与含义见 docs/error-codes.md */
  @ApiProperty({
    enum: ErrorCode,
    enumName: 'ErrorCode',
    example: ErrorCode.COMMON_VALIDATION_FAILED,
  })
  code: ErrorCode;

  /**
   * 错误描述（英文，可直接展示；需要多语言时按 `code` 映射）
   * @example "Validation failed"
   */
  message: string;

  /** 字段级错误明细；仅在参数校验失败、唯一约束冲突等场景出现 */
  details?: ErrorDetailDto[];

  /**
   * HTTP 状态短语
   * @example "Bad Request"
   */
  error: string;

  /**
   * 请求路径
   * @example "/api/auth/register"
   */
  path: string;

  /**
   * 请求 ID，与响应头 `X-Request-Id` 相同；反馈问题时请附上
   * @example "4f1c2a9e-7b3d-4e8a-9c1f-2d5e6a7b8c9d"
   */
  requestId?: string;

  /**
   * 服务端时间（ISO 8601）
   * @example "2026-11-04T02:00:00.000Z"
   */
  timestamp: string;
}

/** 分页信息 */
export class PaginationMetaDto {
  /**
   * 当前页码，从 1 开始
   * @example 1
   */
  @ApiProperty({ type: 'integer' })
  page: number;

  /**
   * 每页条数
   * @example 20
   */
  @ApiProperty({ type: 'integer' })
  limit: number;

  /**
   * 总条数
   * @example 135
   */
  @ApiProperty({ type: 'integer' })
  total: number;

  /**
   * 总页数
   * @example 7
   */
  @ApiProperty({ type: 'integer' })
  totalPages: number;
}

/**
 * Builds a named paginated response class for an item DTO:
 *
 *   export class UserPageDto extends Paginated(UserResponseDto) {}
 *
 * Declare the subclass explicitly (rather than using `Paginated(X)` inline) so the schema
 * gets a stable, readable name in the OpenAPI document.
 */
export function Paginated<TItem>(itemType: Type<TItem>) {
  abstract class PaginatedDto {
    @ApiProperty({ type: () => [itemType], description: '当前页数据' })
    items: TItem[];

    @ApiProperty({ type: () => PaginationMetaDto, description: '分页信息' })
    meta: PaginationMetaDto;
  }
  return PaginatedDto;
}
