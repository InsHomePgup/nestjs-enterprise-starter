# CLAUDE.md

NestJS 11 后端脚手架（实验项目）：Prisma 7 + PostgreSQL、Redis、JWT + RBAC、Swagger、pino。纯后端单体，前端在独立仓库，通过 `openapi.json` 对接。

## 目录结构

```
src/
  main.ts / app.setup.ts   启动入口；configureApp() 统一配置中间件与管道（e2e 共用）
  config/                  配置分组 + Joi 环境变量校验
  common/                  横切能力：错误码(constants)、异常、过滤器、请求上下文(context)、
                           Swagger 后处理(swagger)、通用 DTO、校验
  infra/                   prisma / cache(Redis) / logger(pino)
  modules/                 业务模块：auth、user、health（参照 user 模块的分层写新模块）
  cli/export-openapi.ts    导出 openapi.json
prisma/                    schema/*.prisma、migrations、seed.ts
test/                      e2e（含 OpenAPI 文档质量检查）
docs/                      api-conventions.md（接口规范）、error-codes.md（自动生成）、
                           feature-coverage.md（候选功能清单）、ci-options.md
```

## 常用命令

```bash
pnpm start:dev          # 开发
pnpm test / test:e2e    # 单测 / e2e（e2e 需要 Postgres + Redis）
pnpm exec biome ci .    # lint + 格式检查（pnpm check 自动修复）
pnpm db:migrate         # 改 schema 后生成迁移并提交 prisma/migrations
pnpm docs:errors        # 改错误码后重新生成 docs/error-codes.md
pnpm openapi:export     # 改接口后重新导出 openapi.json 并提交
pnpm release [minor]    # 发版（release-it，需 GITHUB_TOKEN=$(gh auth token)）
```

## 开发约定

详细规则见 `docs/api-conventions.md`，要点：

- 接口文档由 Swagger 插件根据类型和 JSDoc 生成：DTO 字段、Controller 方法都写 JSDoc；方法声明返回类型 `Promise<XxxDto>`
- 鉴权用 `@Auth()` / `@Auth(Role.ADMIN)`，接口特有错误码用 `@ApiErrors(...)`
- 业务错误只抛 `BusinessException(ErrorCode.X)`；新错误码在 `error-code.enum.ts` 登记状态码与说明
- 实验阶段允许破坏性改动，不考虑兼容性，用普通 `feat:` / `fix:` 提交
- 功能按 `docs/feature-coverage.md` 的编号由用户挑选，只做被点名的项
- CI 仅手动触发（`gh workflow run CI`）

## 开发规范

### Git
- 不自动提交代码，只有用户明确说"提交代码"或"commit"时才提交
- commit message 格式：`<type>: <简短描述>`（单行，无项目符号，无详细说明）
- commit message 不含 emoji、"Generated with Claude Code"、"Co-Authored-By" 等 AI 痕迹
