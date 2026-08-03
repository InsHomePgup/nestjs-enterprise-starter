<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">English | <a href="./README.zh-CN.md">简体中文</a></p>

## Description

Enterprise-ready NestJS starter template: PostgreSQL (Prisma 7) + Redis caching + JWT auth skeleton + health checks + structured logging + Docker Compose one-command startup.

### Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL via Prisma 7 (driver adapter, `@prisma/adapter-pg`)
- **Cache**: Redis via `@nestjs/cache-manager` + `@keyv/redis`
- **Auth**: JWT skeleton (`@nestjs/passport` + `passport-jwt`), register/login/`me`, extend for RBAC as needed
- **Docs**: Swagger UI at `/docs`
- **Health checks**: `@nestjs/terminus` at `/health` (Postgres + Redis)
- **Logging**: structured JSON logs via `nestjs-pino` (pretty-printed in development)
- **Security**: `helmet`, global `ValidationPipe`, request rate limiting (`@nestjs/throttler`)

## Project setup

```bash
$ pnpm install
$ cp .env.example .env   # adjust values as needed
```

Requires a running PostgreSQL and Redis instance. Either start them yourself and point `.env` at them, or use the bundled `docker-compose.yml` (see below).

Run the first migration once the database is reachable:

```bash
$ pnpm prisma migrate dev --name init
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

- Swagger docs: http://localhost:3000/docs
- Health check: http://localhost:3000/health

## Run with Docker Compose

Brings up Postgres, Redis, and the app in one command; the app container runs `prisma migrate deploy` automatically on startup.

```bash
$ cp .env.example .env   # adjust JWT_SECRET etc. before first run
$ docker compose up --build
```

For a full walkthrough of installing Docker on a fresh Debian host and operating the stack, see [OPS.md](./OPS.md).

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Roadmap / TODO

- [x] User module: `UserService` + `UserController` (paginated list/detail/update/delete), admin-only
- [x] Auth: refresh token (DB-backed, rotated on use), logout, and password reset flows
- [x] Auth: RBAC via a single `role` field (`USER`/`ADMIN`) with `RolesGuard` + `@Roles()`
- [x] Unified business error codes (`BusinessException` + `code` field in error responses)
- [x] Generic pagination primitives (`PaginationQueryDto`, `PaginatedResult<T>`) reusable across list endpoints
- [x] Tests: unit tests for `AuthService`/`UserService`, e2e tests for auth flows and user CRUD/RBAC
- [ ] Soft delete for `User` (currently a hard delete)
- [ ] Multi-device session management (list/revoke individual refresh tokens per user)
- [ ] CI: `ci.yml` only runs on `workflow_dispatch`; wire it to trigger on `push`/`pull_request`
- [ ] API versioning strategy

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
