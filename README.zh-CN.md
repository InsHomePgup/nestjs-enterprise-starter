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
$ cp .env.example .env   # 按需修改其中的配置项
```

需要一个可用的 PostgreSQL 和 Redis 实例。你可以自行启动并在 `.env` 中配置连接信息，也可以直接使用仓库自带的 `docker-compose.yml`（见下文）。

数据库可连接后，执行首次迁移：

```bash
$ pnpm prisma migrate dev --name init
```

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

一条命令同时启动 Postgres、Redis 和应用本身；应用容器启动时会自动执行 `prisma migrate deploy`。

```bash
$ cp .env.example .env   # 首次运行前请修改 JWT_SECRET 等配置
$ docker compose up --build
```

## 运行测试

```bash
# 单元测试
$ pnpm run test

# e2e 测试
$ pnpm run test:e2e

# 测试覆盖率
$ pnpm run test:cov
```

## 参考资料

- [NestJS 官方文档](https://docs.nestjs.com)
- [Prisma 官方文档](https://www.prisma.io/docs)

## License

Nest 使用 [MIT 协议](https://github.com/nestjs/nest/blob/master/LICENSE)。
