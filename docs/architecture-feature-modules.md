# 方案一：Feature Modules（按业务领域分目录）

## 核心思路

不再按"这是 controller 还是 service"或者"这是 auth 还是 cache"这种技术类型分目录，而是把 `src/` 分成两大类：

- `src/modules/`：业务模块，一个子目录代表一个业务领域（用户、订单、鉴权……），每个子目录内部自带自己的 controller、service、dto、module
- `src/common/`、`src/config/`、`src/infra/`：真正跨模块复用的基础设施（配置、全局过滤器、Prisma/Redis 这类"给所有模块用"的技术组件）

这是 [NestJS 官方风格指南](https://docs.nestjs.com/) 推荐的默认组织方式，也是目前大多数中小型 Nest 项目采用的主流做法。

## 目录结构示例

```
src/
├── modules/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── types/
│   │   │   └── jwt-payload.interface.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts
│   │   └── auth.module.ts
│   ├── health/
│   │   ├── indicators/
│   │   │   ├── prisma-health.indicator.ts
│   │   │   └── redis-health.indicator.ts
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   └── user/                      # 未来新业务模块，同样的结构
│       ├── dto/
│       ├── user.controller.ts
│       ├── user.service.ts
│       └── user.module.ts
├── infra/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── cache/
│       └── cache.module.ts
├── common/
│   └── filters/
│       └── all-exceptions.filter.ts
├── config/
│   ├── configuration.ts
│   └── validation.schema.ts
├── app.module.ts
└── main.ts
```

对照现有代码，改动其实很小：`src/auth` → `src/modules/auth`，`src/health` → `src/modules/health`，`src/prisma`/`src/cache` → `src/infra/prisma`/`src/infra/cache`，`src/common`、`src/config` 保持不动。

## 模块内部约定

每个 `modules/*` 下建议保持一致的文件命名和职责划分：

- `*.module.ts`：声明 imports/controllers/providers/exports
- `*.controller.ts`：只做路由、参数校验（DTO）、调用 service，不写业务逻辑
- `*.service.ts`：业务逻辑，直接依赖 `PrismaService`（简单场景不需要额外抽象一层 Repository）
- `dto/`：请求/响应的数据结构，配合 `class-validator`
- 模块间通信：通过 `imports` + `exports` 显式暴露 provider，禁止绕过 Module 边界互相 `import` 具体实现类

## 优点

- 新增一个业务领域只需要新增一个 `modules/xxx` 目录，边界清晰，多人协作时目录冲突少
- 学习成本低，NestJS 官方文档、CLI 脚手架（`nest g resource`）默认就是这种风格
- 对于模板/起步项目，不引入额外分层概念，理解和上手都快

## 缺点/局限

- Service 层依然直接依赖 Prisma 等具体基础设施，如果未来要写大量不依赖数据库的单元测试，或者要更换 ORM，改造成本会体现出来
- 没有强制的分层规则，业务逻辑、编排逻辑、数据访问逻辑容易都堆在 `*.service.ts` 里，模块内部质量取决于团队自律

## 迁移步骤（相对当前代码）

1. 新建 `src/modules/`、`src/infra/` 目录
2. 移动 `src/auth` → `src/modules/auth`，`src/health` → `src/modules/health`
3. 移动 `src/prisma` → `src/infra/prisma`，`src/cache` → `src/infra/cache`
4. 更新 `app.module.ts` 及各处 import 路径（IDE 全局重命名/移动即可，TypeScript 路径引用会自动跟着改）
5. `src/common`、`src/config` 保持原位，不需要变动
