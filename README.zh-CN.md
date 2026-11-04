<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center"><a href="./README.md">English</a> | 简体中文</p>

## 简介

面向企业级开发的 NestJS 快速启动模板：PostgreSQL（Prisma 7）+ Redis 缓存 + JWT 鉴权骨架 + 健康检查 + 结构化日志 + Docker Compose 一键启动。

### 技术栈

- **框架**：NestJS 11
- **数据库**：PostgreSQL，通过 Prisma 7 驱动适配器（`@prisma/adapter-pg`）访问
- **缓存**：Redis，通过 `@nestjs/cache-manager` + `@keyv/redis` 接入
- **鉴权**：JWT 骨架（`@nestjs/passport` + `passport-jwt`），已提供 register/login/`me`，可按需扩展 RBAC 等业务鉴权逻辑
- **文档**：Swagger UI，路径 `/docs`
- **健康检查**：`@nestjs/terminus`，路径 `/health`（聚合 Postgres + Redis）
- **日志**：`nestjs-pino` 输出结构化 JSON 日志（开发环境下自动美化输出）
- **安全**：`helmet`、全局 `ValidationPipe`、请求限流（`@nestjs/throttler`）

## 项目初始化

```bash
$ pnpm install
```

配置按 `.env` → `.env.${NODE_ENV}` 的顺序加载，同名变量以先读到的为准，真实环境变量优先级最高。开发环境默认直接使用已提交的 `.env.development`；需要在本机覆盖某些值时，再创建 `.env`（可参考 `.env.example`，该文件不入库）。

需要一个可用的 PostgreSQL 和 Redis 实例。你可以自行启动并配置连接信息，也可以直接使用仓库自带的 `docker-compose.yml`（见下文）。

数据库可连接后，执行迁移并创建初始管理员：

```bash
$ pnpm db:migrate   # 应用 prisma/migrations 下的全部迁移
$ pnpm db:seed      # 创建管理员（开发环境默认 admin@example.com / admin12345）
```

## 数据库迁移

- 修改 `prisma/schema/*.prisma` 后执行 `pnpm db:migrate --name <变更说明>`，并将生成的 `prisma/migrations/*` 一并提交。
- CI 会检查 schema 与迁移是否一致，漏提交迁移会导致 CI 失败。
- 生产环境由容器启动时自动执行 `prisma migrate deploy`，不要在生产环境运行 `migrate dev`。
- 常用命令：`db:generate`、`db:migrate`、`db:deploy`、`db:seed`、`db:reset`、`db:studio`。

## 编译与运行

```bash
# 开发模式
$ pnpm run start

# 监听模式
$ pnpm run start:dev

# 生产模式
$ pnpm run start:prod
```

- Swagger 文档：http://localhost:3000/docs
- 健康检查：http://localhost:3000/health

## 使用 Docker Compose 运行

一条命令同时启动 Postgres、Redis 和应用本身。应用容器启动时依次执行：`prisma migrate deploy` → seed（若设置了 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 则创建管理员，否则跳过）→ 启动服务。

```bash
$ cp .env.example .env
# 首次运行前必须修改：
#   JWT_SECRET          生产模式下至少 32 位且不能是占位值，否则应用拒绝启动（可用 openssl rand -hex 32 生成）
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   初始管理员账号（可选）
$ docker compose up --build
```

在全新的 Debian 主机上安装 Docker 并运维本项目的完整步骤，参见 [OPS.zh-CN.md](./OPS.zh-CN.md)。

## 接口契约与错误码

- **接口文档**：Swagger UI 地址是 `/docs`，原始 JSON 在 `/docs-json`。文档由 Swagger CLI 插件根据 TypeScript 类型和 JSDoc 注释自动生成；有接口或 DTO 字段没写注释时，e2e 的文档质量检查会失败。
- **契约文件**：`pnpm openapi:export` 生成 `openapi.json`。它提交在仓库里，CI 会检查它是否最新，每次发版都会作为附件上传到 GitHub Release。前端用它生成带类型的请求代码，例如 `npx openapi-typescript openapi.json -o schema.d.ts`，或者用 `npx orval`。
- **成功响应**统一包装为 `{ statusCode, data, path, requestId, timestamp }`。
- **错误响应**使用统一结构，并带有固定不变的业务错误码 `code`：

```json
{
  "statusCode": 400,
  "code": "COMMON_VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [{ "field": "email", "rule": "isEmail", "message": "email must be an email" }],
  "error": "Bad Request",
  "path": "/api/auth/register",
  "requestId": "4f1c...",
  "timestamp": "2026-11-04T02:00:00.000Z"
}
```

- 全部错误码及其 HTTP 状态、含义和前端处理方式：[docs/error-codes.md](./docs/error-codes.md)（由 `pnpm docs:errors` 自动生成）。
- 排查问题：每个响应都带 `X-Request-Id` 头；每个请求只产生一条访问日志，包含 `reqId`、`userId`、`errorCode`，5xx 还带完整堆栈。日志里的敏感信息已打码。
- 怎样写接口、DTO 和错误码才能保证上面这些都成立：[docs/api-conventions.md](./docs/api-conventions.md)。

## 运行测试

```bash
# 单元测试
$ pnpm run test

# e2e 测试
$ pnpm run test:e2e

# 测试覆盖率
$ pnpm run test:cov
```

## 发版与更新日志

版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)，由 [release-it](https://github.com/release-it/release-it) 根据 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 自动生成 `CHANGELOG.md`。

- `fix:` → patch，`feat:` → minor，`feat!:`（破坏性改动）→ major；`docs`/`refactor`/`ci`/`chore` 等只进入 CHANGELOG，不单独触发升级。
- 本地发版：

  ```bash
  $ GITHUB_TOKEN=$(gh auth token) pnpm release          # 自动推荐版本号，交互确认
  $ GITHUB_TOKEN=$(gh auth token) pnpm release minor    # 指定升级级别
  ```

- 也可以在 GitHub Actions 中手动触发 **Release** 工作流（可选 auto / patch / minor / major）。
- 发版会依次：lint + 单测 + 构建 → 升级 `package.json` 版本 → 生成 CHANGELOG → 提交 `chore: release vX.Y.Z` → 打 tag → 推送 → 创建 GitHub Release。

## 路线图 / TODO

> 完整的候选功能清单（含覆盖状态、工作量与依赖关系）见 [docs/feature-coverage.md](./docs/feature-coverage.md)，按实际需求挑选实施。

- [x] User 模块：`UserService` + `UserController`（分页列表/详情/更新/删除），仅管理员可访问
- [x] Auth：refresh token（数据库存储，使用后轮换）、登出、找回密码流程
- [x] Auth：基于单一 `role` 字段（`USER`/`ADMIN`）的 RBAC，配合 `RolesGuard` + `@Roles()`
- [x] 统一业务错误码（`BusinessException`，错误响应体新增 `code` 字段）
- [x] 通用分页原语（`PaginationQueryDto`、`PaginatedResult<T>`），可被其他列表接口复用
- [x] 测试：`AuthService`/`UserService` 单元测试，Auth 流程与 User CRUD/RBAC 的 e2e 测试
- [ ] User 软删除（目前是硬删除）
- [ ] 多设备会话管理（查看/撤销某用户的单个 refresh token）
- [x] CI：手动触发（`gh workflow run CI`），内置 Postgres、Redis 服务，并检查迁移是否与 schema 一致；可选的扩展 CI 见 [docs/ci-options.md](./docs/ci-options.md)
- [ ] 制定 API 版本管理策略

## 参考资料

- [NestJS 官方文档](https://docs.nestjs.com)
- [Prisma 官方文档](https://www.prisma.io/docs)

## License

Nest 使用 [MIT 协议](https://github.com/nestjs/nest/blob/master/LICENSE)。
