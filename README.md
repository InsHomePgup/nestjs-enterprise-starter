<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

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

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
