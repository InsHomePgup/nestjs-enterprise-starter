# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# --- install all deps (needed to build) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- install production-only deps ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"
RUN pnpm prisma generate
RUN pnpm build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app && chown app:app /app
COPY --chown=app:app package.json pnpm-lock.yaml prisma.config.ts ./
COPY --chown=app:app --from=prod-deps /app/node_modules ./node_modules
COPY --chown=app:app --from=build /app/dist ./dist
COPY --chown=app:app --from=build /app/prisma ./prisma
USER app
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main"]
