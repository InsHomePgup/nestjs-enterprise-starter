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
```

Config is loaded from `.env` then `.env.${NODE_ENV}`; the first file defining a key wins, and real environment variables beat both. In development the committed `.env.development` is used as-is; create a local, git-ignored `.env` (see `.env.example`) only to override values on your machine.

Requires a running PostgreSQL and Redis instance. Either start them yourself and point the config at them, or use the bundled `docker-compose.yml` (see below).

Once the database is reachable, apply migrations and create the initial admin:

```bash
$ pnpm db:migrate   # applies everything in prisma/migrations
$ pnpm db:seed      # creates the admin (dev default: admin@example.com / admin12345)
```

## Database migrations

- After editing `prisma/schema/*.prisma`, run `pnpm db:migrate --name <change>` and commit the generated `prisma/migrations/*`.
- CI verifies migrations match the schema, so a forgotten migration fails the build.
- Production applies migrations via `prisma migrate deploy` on container start; never run `migrate dev` against production.
- Scripts: `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:reset`, `db:studio`.

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

Brings up Postgres, Redis, and the app in one command. On startup the app container runs `prisma migrate deploy` → seed (creates the admin if `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are set, otherwise skips) → the server.

```bash
$ cp .env.example .env
# Before the first run, set:
#   JWT_SECRET          in production it must be >= 32 chars and not a placeholder, or the app
#                       refuses to start (generate one with: openssl rand -hex 32)
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   initial admin account (optional)
$ docker compose up --build
```

For a full walkthrough of installing Docker on a fresh Debian host and operating the stack, see [OPS.md](./OPS.md).

## Error response format

Every error uses the same shape, so clients can branch on `code`:

```json
{
  "statusCode": 400,
  "code": "COMMON_VALIDATION_FAILED",
  "message": "Validation failed",
  "details": ["email must be an email"],
  "error": "BadRequestException",
  "path": "/api/auth/register",
  "requestId": "4f1c...",
  "timestamp": "2026-11-04T02:00:00.000Z"
}
```

- `message` is always a string; `details` is present only for validation failures.
- Codes live in `src/common/constants/error-code.enum.ts`. Prisma unique-constraint / record-not-found errors are mapped to 409 / 404 automatically.

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
- [x] CI: runs on push / PR with Postgres and Redis services, and checks migrations match the schema
- [ ] API versioning strategy

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
