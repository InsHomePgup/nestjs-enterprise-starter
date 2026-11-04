# 错误码

<!-- 本文件由 `pnpm docs:errors` 根据 src/common/constants/error-code.enum.ts 自动生成，请勿手动编辑。 -->

所有错误响应都使用统一结构，前端应以 `code` 作为分支依据（`message` 仅用于展示，可能调整）：

```json
{
  "statusCode": 400,
  "code": "COMMON_VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [{ "field": "email", "rule": "isEmail", "message": "email must be an email" }],
  "error": "Bad Request",
  "path": "/api/auth/register",
  "requestId": "4f1c2a9e-…",
  "timestamp": "2026-11-04T02:00:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `statusCode` | HTTP 状态码，与响应状态一致 |
| `code` | 业务错误码，见下表；**同一个错误码永远对应同一个 HTTP 状态码** |
| `message` | 英文描述，可直接展示；前端需要多语言时按 `code` 自行映射 |
| `details` | 可选。字段级问题列表：`field`（点分路径，如 `items.0.price`）、`rule`（失败的规则，如 `isEmail`、`unique`）、`message` |
| `error` | HTTP 状态短语，如 `Bad Request` |
| `requestId` | 请求 ID，与响应头 `X-Request-Id` 相同 |

## 排查问题

1. 从响应体或响应头 `X-Request-Id` 拿到 `requestId`。
2. 在日志中按 `reqId` / `req.id` 检索，即可看到该请求的完整访问日志：方法、路径、状态码、耗时、`errorCode`、`userId`；5xx 还包含完整的异常堆栈。
3. 前端可以在请求时自行带上 `X-Request-Id`（1～128 位字母、数字、`._:-`），后端会沿用该值，便于前后端日志串联。

## COMMON：通用 / 框架层

| 错误码 | HTTP | 默认 message | 何时出现 | 前端处理 / 排查提示 |
|---|---|---|---|---|
| `COMMON_BAD_REQUEST` | 400 | Bad request | 请求无法处理，且不属于更具体的错误类型（兜底的 4xx）。 | 检查请求方法、请求头和请求体是否符合接口文档；附上 requestId 联系后端。 |
| `COMMON_VALIDATION_FAILED` | 400 | Validation failed | 请求参数（body / query / path）未通过校验。 | `details` 中按字段列出了错误（field / rule / message），可直接映射到表单字段提示。 |
| `COMMON_MALFORMED_JSON` | 400 | Malformed JSON body | 请求体不是合法的 JSON。 | 检查 Content-Type 是否为 application/json，以及请求体序列化是否正确。 |
| `COMMON_PAYLOAD_TOO_LARGE` | 413 | Payload too large | 请求体超过服务端允许的大小上限。 | 减小请求体；上传文件请使用专门的上传接口。 |
| `COMMON_UNAUTHORIZED` | 401 | Unauthorized | 未认证（兜底）。认证相关的具体原因优先使用 `AUTH_*` 错误码。 | 跳转登录页。 |
| `COMMON_FORBIDDEN` | 403 | Forbidden | 已认证但无权执行该操作（兜底）。 | 提示无权限；不要自动重试。 |
| `COMMON_NOT_FOUND` | 404 | Resource not found | 请求的资源不存在（兜底）。具体资源优先使用 `<MODULE>_NOT_FOUND`。 | 提示资源不存在或已被删除。 |
| `COMMON_ROUTE_NOT_FOUND` | 404 | Route not found | 请求的接口地址不存在（路径或 HTTP 方法错误）。 | 多为前端调用错误：核对接口路径、/api 前缀、版本号与 HTTP 方法。 |
| `COMMON_CONFLICT` | 409 | Resource conflict | 与现有数据冲突，例如唯一字段重复。 | `details` 中会给出冲突字段（rule = unique），可提示用户修改该字段。 |
| `COMMON_TOO_MANY_REQUESTS` | 429 | Too many requests | 触发限流。 | 稍后重试；不要立即自动重试，避免加剧限流。 |
| `COMMON_INTERNAL_ERROR` | 500 | Internal server error | 服务端未预期的异常（代码缺陷等）。 | 提示"系统繁忙"；把响应中的 requestId 提供给后端，按 requestId 检索日志即可看到完整堆栈。 |
| `COMMON_SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | 依赖服务（数据库等）暂时不可用或连接超时。 | 可稍后重试；后端排查数据库 / 网络状态与 /health 接口。 |

## AUTH：认证与授权

| 错误码 | HTTP | 默认 message | 何时出现 | 前端处理 / 排查提示 |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | 登录时邮箱不存在或密码错误（两者故意不区分，防止账号枚举）。 | 提示"邮箱或密码错误"。 |
| `AUTH_EMAIL_TAKEN` | 409 | Email is already registered | 注册时邮箱已被占用。 | 提示更换邮箱或直接登录。 |
| `AUTH_TOKEN_MISSING` | 401 | Access token is missing | 需要登录的接口未携带 `Authorization: Bearer <token>` 请求头。 | 跳转登录页；若已登录，检查请求拦截器是否正确附加了 token。 |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token has expired | access token 已过期。 | 用 refresh token 调用 /auth/refresh 换取新 token 后重放原请求；刷新失败再跳转登录页。 |
| `AUTH_TOKEN_INVALID` | 401 | Access token is invalid | access token 格式错误、签名不匹配或已被篡改。 | 清除本地 token 并跳转登录页（不要尝试刷新）。 |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Refresh token is invalid or expired | refresh token 不存在、已过期、已被使用（轮换后旧 token 失效）或已登出。 | 清除本地 token 并跳转登录页。并发刷新时只有一个请求会成功，前端应对刷新请求做单飞（single-flight）。 |
| `AUTH_RESET_TOKEN_INVALID` | 401 | Password reset token is invalid or expired | 重置密码链接中的 token 不存在、已过期或已被使用。 | 提示链接已失效，引导用户重新发起"忘记密码"。 |
| `AUTH_FORBIDDEN` | 403 | Insufficient permissions | 当前用户的角色无权访问该接口。 | 提示无权限；隐藏或禁用对应的入口。 |

## USER：用户

| 错误码 | HTTP | 默认 message | 何时出现 | 前端处理 / 排查提示 |
|---|---|---|---|---|
| `USER_NOT_FOUND` | 404 | User not found | 指定的用户不存在或已被删除。 | 提示用户不存在；列表页可刷新数据。 |
