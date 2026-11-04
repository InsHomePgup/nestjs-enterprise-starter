import { HttpStatus } from '@nestjs/common';

/**
 * Every error code the API can return. Naming: `<MODULE>_<REASON>` in UPPER_SNAKE_CASE.
 *
 * Adding a code: add it here AND to {@link ERROR_CODE_DEFINITIONS} (the compiler enforces
 * this), then run `pnpm docs:errors` to regenerate docs/error-codes.md.
 * Codes are part of the API contract: never rename or reuse one; deprecate instead.
 */
export enum ErrorCode {
  // ---- COMMON: framework-level / cross-cutting ----
  COMMON_BAD_REQUEST = 'COMMON_BAD_REQUEST',
  COMMON_VALIDATION_FAILED = 'COMMON_VALIDATION_FAILED',
  COMMON_MALFORMED_JSON = 'COMMON_MALFORMED_JSON',
  COMMON_PAYLOAD_TOO_LARGE = 'COMMON_PAYLOAD_TOO_LARGE',
  COMMON_UNAUTHORIZED = 'COMMON_UNAUTHORIZED',
  COMMON_FORBIDDEN = 'COMMON_FORBIDDEN',
  COMMON_NOT_FOUND = 'COMMON_NOT_FOUND',
  COMMON_ROUTE_NOT_FOUND = 'COMMON_ROUTE_NOT_FOUND',
  COMMON_CONFLICT = 'COMMON_CONFLICT',
  COMMON_TOO_MANY_REQUESTS = 'COMMON_TOO_MANY_REQUESTS',
  COMMON_INTERNAL_ERROR = 'COMMON_INTERNAL_ERROR',
  COMMON_SERVICE_UNAVAILABLE = 'COMMON_SERVICE_UNAVAILABLE',

  // ---- AUTH: authentication & authorization ----
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_TAKEN = 'AUTH_EMAIL_TAKEN',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_RESET_TOKEN_INVALID = 'AUTH_RESET_TOKEN_INVALID',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',

  // ---- USER ----
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

export interface ErrorCodeDefinition {
  /** HTTP status sent with this code. */
  status: HttpStatus;
  /** Default `message` in the response body (English, stable, safe to show to end users). */
  message: string;
  /** 何时出现（中文，用于文档）。 */
  description: string;
  /** 前端建议处理方式 / 排查提示（中文，用于文档）。 */
  hint: string;
}

/**
 * Single source of truth for status, default message and documentation of each code.
 * Used by BusinessException (status + default message), the exception filter, Swagger and
 * the generated docs/error-codes.md.
 */
export const ERROR_CODE_DEFINITIONS: Record<ErrorCode, ErrorCodeDefinition> = {
  [ErrorCode.COMMON_BAD_REQUEST]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Bad request',
    description: '请求无法处理，且不属于更具体的错误类型（兜底的 4xx）。',
    hint: '检查请求方法、请求头和请求体是否符合接口文档；附上 requestId 联系后端。',
  },
  [ErrorCode.COMMON_VALIDATION_FAILED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Validation failed',
    description: '请求参数（body / query / path）未通过校验。',
    hint: '`details` 中按字段列出了错误（field / rule / message），可直接映射到表单字段提示。',
  },
  [ErrorCode.COMMON_MALFORMED_JSON]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Malformed JSON body',
    description: '请求体不是合法的 JSON。',
    hint: '检查 Content-Type 是否为 application/json，以及请求体序列化是否正确。',
  },
  [ErrorCode.COMMON_PAYLOAD_TOO_LARGE]: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Payload too large',
    description: '请求体超过服务端允许的大小上限。',
    hint: '减小请求体；上传文件请使用专门的上传接口。',
  },
  [ErrorCode.COMMON_UNAUTHORIZED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Unauthorized',
    description: '未认证（兜底）。认证相关的具体原因优先使用 `AUTH_*` 错误码。',
    hint: '跳转登录页。',
  },
  [ErrorCode.COMMON_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Forbidden',
    description: '已认证但无权执行该操作（兜底）。',
    hint: '提示无权限；不要自动重试。',
  },
  [ErrorCode.COMMON_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Resource not found',
    description: '请求的资源不存在（兜底）。具体资源优先使用 `<MODULE>_NOT_FOUND`。',
    hint: '提示资源不存在或已被删除。',
  },
  [ErrorCode.COMMON_ROUTE_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Route not found',
    description: '请求的接口地址不存在（路径或 HTTP 方法错误）。',
    hint: '多为前端调用错误：核对接口路径、/api 前缀、版本号与 HTTP 方法。',
  },
  [ErrorCode.COMMON_CONFLICT]: {
    status: HttpStatus.CONFLICT,
    message: 'Resource conflict',
    description: '与现有数据冲突，例如唯一字段重复。',
    hint: '`details` 中会给出冲突字段（rule = unique），可提示用户修改该字段。',
  },
  [ErrorCode.COMMON_TOO_MANY_REQUESTS]: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Too many requests',
    description: '触发限流。',
    hint: '稍后重试；不要立即自动重试，避免加剧限流。',
  },
  [ErrorCode.COMMON_INTERNAL_ERROR]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    description: '服务端未预期的异常（代码缺陷等）。',
    hint: '提示"系统繁忙"；把响应中的 requestId 提供给后端，按 requestId 检索日志即可看到完整堆栈。',
  },
  [ErrorCode.COMMON_SERVICE_UNAVAILABLE]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Service temporarily unavailable',
    description: '依赖服务（数据库等）暂时不可用或连接超时。',
    hint: '可稍后重试；后端排查数据库 / 网络状态与 /health 接口。',
  },

  [ErrorCode.AUTH_INVALID_CREDENTIALS]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid email or password',
    description: '登录时邮箱不存在或密码错误（两者故意不区分，防止账号枚举）。',
    hint: '提示"邮箱或密码错误"。',
  },
  [ErrorCode.AUTH_EMAIL_TAKEN]: {
    status: HttpStatus.CONFLICT,
    message: 'Email is already registered',
    description: '注册时邮箱已被占用。',
    hint: '提示更换邮箱或直接登录。',
  },
  [ErrorCode.AUTH_TOKEN_MISSING]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Access token is missing',
    description: '需要登录的接口未携带 `Authorization: Bearer <token>` 请求头。',
    hint: '跳转登录页；若已登录，检查请求拦截器是否正确附加了 token。',
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Access token has expired',
    description: 'access token 已过期。',
    hint: '用 refresh token 调用 /auth/refresh 换取新 token 后重放原请求；刷新失败再跳转登录页。',
  },
  [ErrorCode.AUTH_TOKEN_INVALID]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Access token is invalid',
    description: 'access token 格式错误、签名不匹配或已被篡改。',
    hint: '清除本地 token 并跳转登录页（不要尝试刷新）。',
  },
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Refresh token is invalid or expired',
    description: 'refresh token 不存在、已过期、已被使用（轮换后旧 token 失效）或已登出。',
    hint: '清除本地 token 并跳转登录页。并发刷新时只有一个请求会成功，前端应对刷新请求做单飞（single-flight）。',
  },
  [ErrorCode.AUTH_RESET_TOKEN_INVALID]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Password reset token is invalid or expired',
    description: '重置密码链接中的 token 不存在、已过期或已被使用。',
    hint: '提示链接已失效，引导用户重新发起"忘记密码"。',
  },
  [ErrorCode.AUTH_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Insufficient permissions',
    description: '当前用户的角色无权访问该接口。',
    hint: '提示无权限；隐藏或禁用对应的入口。',
  },

  [ErrorCode.USER_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'User not found',
    description: '指定的用户不存在或已被删除。',
    hint: '提示用户不存在；列表页可刷新数据。',
  },
};

/** One field-level (or constraint-level) problem in an error response. */
export interface ErrorDetail {
  /** Dotted path of the offending field, e.g. `email` or `items.0.price`. */
  field?: string;
  /** Machine-readable rule that failed, e.g. `isEmail`, `minLength`, `unique`. */
  rule?: string;
  /** Human-readable explanation (English). */
  message: string;
}
