# 接口开发规范

本文说明如何新增或修改接口，才能保证两件事：

1. **接口文档完整、准确**：前端拿到 `openapi.json` 生成的类型，和后端实际返回的数据完全一致；
2. **错误码完善**：前端可以按错误码做精确处理，出了问题能凭 `requestId` 快速定位。

大部分规则都有测试兜底，违反时 `pnpm test` / `pnpm test:e2e` 会失败，并在错误信息里说明缺了什么。

---

## 1. 响应结构

### 成功响应

所有接口的返回值都会被统一包装（`TransformInterceptor`），业务数据放在 `data` 中：

```json
{
  "statusCode": 200,
  "data": { "id": "…", "email": "alice@example.com" },
  "path": "/api/auth/me",
  "requestId": "4f1c2a9e-…",
  "timestamp": "2026-11-04T02:00:00.000Z"
}
```

- Controller 方法**只返回业务数据**，不要自己包这一层。
- 返回 `204` 的接口（登出、删除等）没有响应体。
- 少数接口的返回格式由外部决定（健康检查、Webhook、文件流），这类接口用 `@SkipResponseTransform()` 跳过包装，文档里也会相应地不包装。

### 错误响应

所有错误都使用 `ErrorResponseDto` 结构，完整的错误码列表见 [error-codes.md](./error-codes.md)：

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

---

## 2. 写接口文档

文档由 Swagger CLI 插件根据 **TypeScript 类型和 JSDoc 注释**自动生成。写好类型和注释，文档就写好了。

### DTO：每个字段都写 JSDoc

```ts
/** 注册请求 */
export class RegisterDto {
  /**
   * 邮箱，作为登录账号，全局唯一
   * @example "alice@example.com"
   */
  @IsEmail()
  @MaxLength(254)
  email: string;
}
```

- 注释第一段会成为字段的 `description`，`@example` 会成为示例值。
- class-validator 的规则会自动同步到文档：`@MinLength` 对应 `minLength`，`@IsEmail` 对应 `format: email`，`@Max` 对应 `maximum`，以此类推。所以**不需要手写 `@ApiProperty`**。
- 文件名必须以 `.dto.ts` 结尾，插件只处理这类文件。
- 以下几种情况仍然需要手写 `@ApiProperty`：
  - Prisma 生成的枚举：`@ApiProperty({ enum: Role, enumName: 'Role' })`，写上 `enumName`，前端才能生成命名枚举类型；
  - 整数字段：`@ApiProperty({ type: 'integer' })`，否则文档里只会显示为 `number`；
  - 泛型字段（见下面的分页）。
- 字符串字段都应该加 `@MaxLength`，前端可以照着做表单校验。
- 可以为空的字段写成 `string | null`，文档会自动标记为 `nullable`。

### 响应 DTO

- 每个接口都要有明确的响应 DTO 类，不要直接返回 Prisma 实体，否则可能把密码这类字段泄漏出去，文档也不准确。
- 分页接口为每种列表声明一个具体的类：

  ```ts
  export class UserPageDto extends Paginated(UserResponseDto) {}
  ```

### Controller：JSDoc + 返回类型 + 错误码

```ts
@ApiTags('users')
@Auth(Role.ADMIN)                       // 守卫 + 文档中的 401/403 一次搞定
@Controller('users')
export class UserController {
  /**
   * 用户详情                             ← 第一段：接口摘要（单行）
   *
   * 补充说明……                           ← 其余：接口描述（可多行）
   */
  @Get(':id')
  @ApiErrors(ErrorCode.USER_NOT_FOUND)  // 本接口特有的错误码
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {  // ← 返回类型即响应文档
    return this.userService.findOne(id);
  }
}
```

| 要求 | 原因 |
|---|---|
| 方法必须写 JSDoc | 第一段成为接口摘要（前端生成的函数注释），其余成为接口描述 |
| 必须声明返回类型 `Promise<XxxDto>` | 插件根据返回类型生成响应 schema |
| 需要登录的接口用 `@Auth()` / `@Auth(Role.ADMIN)` | 同时加上守卫、文档里的鉴权标记，以及 `AUTH_TOKEN_*` / `AUTH_FORBIDDEN` 错误码，保证文档和实际行为一致。**不要直接用 `@UseGuards(JwtAuthGuard)`** |
| 用 `@ApiErrors(...)` 列出本接口特有的错误码 | 通用错误码（参数校验、JSON 格式错误、请求体过大、限流、500、503）会自动添加，不用重复写 |
| `POST` 接口如果不是"创建资源"，加 `@HttpCode(HttpStatus.OK)` | 例如登录、刷新令牌应该返回 200 而不是 201 |
| 删除接口返回 `204` | `@HttpCode(HttpStatus.NO_CONTENT)`，返回类型为 `Promise<void>` |

### 文档质量检查（自动）

`test/openapi.e2e-spec.ts` 会对生成的文档逐项检查，任何一项不满足 e2e 测试都会失败：

- 每个接口都有单行摘要、标签和唯一的 operationId；
- 每个 2xx 响应都声明了响应体类型（204 除外）；
- 每个接口都列出了错误响应和错误码；需要鉴权的接口必须有 401；
- **每个 DTO 字段都有描述**（也就是都写了 JSDoc）；
- 枚举都是命名 schema；`ErrorCode` 列出了全部错误码及其说明；
- 文档版本号等于 `package.json` 的版本号。

本地查看文档：启动服务后打开 `http://localhost:3000/docs`，原始 JSON 在 `/docs-json`。

---

## 3. 错误码规范

### 命名

- 格式为 `<模块>_<原因>`，全部大写，用下划线分隔，例如 `USER_NOT_FOUND`、`AUTH_TOKEN_EXPIRED`。
- `COMMON_*` 只用于框架层和跨模块的通用错误；具体业务尽量使用带模块前缀的错误码，前端处理起来更精确。
- 错误码要描述**原因**而不是现象：`AUTH_TOKEN_EXPIRED` 比 `AUTH_FAILED` 好。
- **同一个错误码永远对应同一个 HTTP 状态码**，这由注册表保证。

### 新增一个错误码

1. 在 `src/common/constants/error-code.enum.ts` 的 `ErrorCode` 枚举里加上它。
2. 在同一个文件的 `ERROR_CODE_DEFINITIONS` 里补全它的定义；漏写时编译器会直接报错：
   - `status`：HTTP 状态码；
   - `message`：默认的英文提示，要能直接展示给最终用户，不能包含内部细节；
   - `description`：什么情况下会出现（中文）；
   - `hint`：前端应该怎么处理，以及排查时看什么（中文）。
3. 执行 `pnpm docs:errors` 重新生成 [error-codes.md](./error-codes.md)；忘记这一步单测会失败。
4. 在会抛出它的接口上加 `@ApiErrors(ErrorCode.XXX)`。

### 抛出错误

```ts
throw new BusinessException(ErrorCode.USER_NOT_FOUND);

// 自定义提示，或者带上字段级明细
throw new BusinessException(ErrorCode.COMMON_CONFLICT, {
  message: 'Slug already in use',
  details: [{ field: 'slug', rule: 'unique', message: 'slug already exists' }],
  cause: originalError, // 只写入日志，不会返回给前端
});
```

- 业务代码里**只抛 `BusinessException`**，不要直接抛 `HttpException` 或 `BadRequestException`。
- 下面这些情况不需要手动处理，会自动转成对应的错误码：
  - 参数校验失败 → `COMMON_VALIDATION_FAILED`，`details` 按字段列出；
  - 唯一约束冲突 → `COMMON_CONFLICT`，`details` 会带上冲突的字段；
  - 数据库连接失败 → `COMMON_SERVICE_UNAVAILABLE`（503）；
  - 访问不存在的路由 → `COMMON_ROUTE_NOT_FOUND`。
- 如果某个唯一约束冲突有更具体的业务含义，比如"邮箱已被注册"，就在 Service 里捕获后转成对应的业务错误码（参见 `AuthService.register` 对 `AUTH_EMAIL_TAKEN` 的处理）。

### 错误码属于接口契约

- 错误码**不能改名，也不能删除**。前端可能正依赖它做分支判断。
- 如果确实要废弃某个错误码，先在 `description` 里注明"已废弃，改用 XXX"，保留至少一个大版本后再删除，并且删除时要用 `feat!:` 提交。

---

## 4. 排查问题

1. 前端拿到错误后，从响应体或响应头 `X-Request-Id` 取得 `requestId`。前端也可以在请求时自己生成一个，放在 `X-Request-Id` 请求头里，后端会沿用它。
2. 后端在日志里按 `reqId` 搜索。**每个请求只有一条访问日志**，内容包括：
   - 方法、路径、状态码、耗时；
   - `errorCode`；
   - `userId`（已登录的请求）；
   - 5xx 时附带完整的异常堆栈。
3. 日志里的 `Authorization`、`Cookie`，以及 `password`、`token` 这类字段都已经打码，可以放心转发给别人。

---

## 5. 前端对接

### 获取契约

- **开发中**：直接读取后端的 `/docs-json`，或者仓库根目录的 `openapi.json`。
- **按版本对接（推荐）**：每个 GitHub Release 都附带对应版本的 `openapi.json`，前端固定使用某个版本生成代码，看过 CHANGELOG 后再升级。
- 后端版本号也可以通过 `GET /api` 获取（返回 `{ name, version }`）。

### 生成类型和请求代码

任选一种工具：

```bash
# 只生成类型
npx openapi-typescript ./openapi.json -o src/api/schema.d.ts

# 生成类型 + 请求函数 + React Query / Vue Query hooks
npx orval --input ./openapi.json --output src/api
```

生成之后，前端能得到：

- 每个接口的请求参数和响应 `data` 的完整类型；字段注释会出现在 IDE 的悬浮提示里；
- `Role`、`ErrorCode` 等命名枚举；
- 每个接口可能返回的错误码（文档中 `x-error-codes` 扩展字段，以及各个错误状态码下的 `code` 枚举）。

### 推荐的前端错误处理

```ts
switch (error.code) {
  case 'AUTH_TOKEN_EXPIRED':
    // 刷新令牌后重放原请求；同一时间只发起一次刷新（single-flight）
    return refreshAndRetry(request);
  case 'AUTH_TOKEN_MISSING':
  case 'AUTH_TOKEN_INVALID':
  case 'AUTH_REFRESH_TOKEN_INVALID':
    // 清除本地令牌，跳转登录页
    return logoutAndRedirect();
  case 'COMMON_VALIDATION_FAILED':
    // 把 details 按 field 显示到对应的表单项下
    return showFieldErrors(error.details);
  default:
    // 展示 message，并在反馈入口附带 requestId
    return toast(error.message, { requestId: error.requestId });
}
```

---

## 6. 契约变更与版本

`openapi.json` 是前后端之间的契约，有以下几道自动检查：

| 检查 | 时机 | 失败时怎么处理 |
|---|---|---|
| `openapi.json` 是否最新 | CI | 执行 `pnpm openapi:export`，把更新后的 `openapi.json` 一起提交 |
| 是否有破坏性改动 | CI，与上一个发版 tag 的 `openapi.json` 对比（oasdiff） | 如果是有意为之，用 `feat!:` / `fix!:` 提交，下次发版会自动升大版本；否则改成向后兼容的写法 |
| 文档版本号 | 发版时 | 自动同步，不需要处理 |

**破坏性改动**包括：删除字段或接口、修改字段类型、可选字段改为必填（请求中）、必填字段改为可选（响应中）、修改错误码等。

**非破坏性改动**包括：新增接口、在请求中新增可选字段、在响应中新增字段。
