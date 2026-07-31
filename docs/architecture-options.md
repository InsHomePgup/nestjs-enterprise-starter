# 模块化架构方案对比

当前 `src/` 目录是按**技术类型**平铺组织的（`auth/`、`cache/`、`health/`、`prisma/`、`config/`、`common/`），随着业务模块增多（订单、商品、通知……），`auth/` 这类目录会和未来的业务模块混在同一层级，边界会越来越模糊。这里给出三种模块化方案，从轻到重，供选择：

| 方案 | 核心思路 | 适合场景 | 迁移成本 |
| --- | --- | --- | --- |
| [方案一：Feature Modules](./architecture-feature-modules.md) | 按业务领域分目录，每个目录自带 controller/service/dto | 中小团队、模板/起步项目、业务模块不算特别多 | 低 |
| [方案二：Hexagonal / Clean Architecture](./architecture-hexagonal.md) | 每个模块内再拆 domain / application / infrastructure 三层，业务逻辑与 Prisma、Redis 等基础设施解耦 | 核心业务逻辑复杂、需要强可测试性、可能更换基础设施（如换 ORM） | 中高 |
| [方案三：DDD 模块化单体（Bounded Context）](./architecture-ddd-bounded-context.md) | 以限界上下文（Bounded Context）划分顶层目录，每个上下文内部再用方案一或方案二组织 | 大型团队、多领域协作、未来可能拆分为微服务 | 高 |

## 如何选择

- 如果只是希望比现在更整洁、上手成本低 → **方案一**，这也是 NestJS 官方风格指南推荐的默认做法。
- 如果业务逻辑本身很重、想让 Service 层不直接依赖 Prisma（方便写单元测试、方便未来换 ORM）→ **方案二**，可以只在核心模块（比如订单、计费）用，其余简单模块（比如 health、auth）保持方案一的轻量结构。
- 如果这个模板未来会演化成多个业务域、甚至可能拆微服务 → **方案三**，前期投入的目录约定会在后期减少拆分成本。

三个方案不是互斥的：方案一是基础骨架，方案二是"模块内部再分层"的增强，方案三是"模块外部再分组"的增强，可以按模块的复杂度混合使用（例如：整体是方案一，其中一两个核心模块内部用方案二分层）。

## 与当前代码的映射

以现有的 `auth` 模块为例，三个方案下它的落点分别是：

- 方案一：`src/modules/auth/`（内容基本不变，只是从 `src/auth` 挪到 `src/modules/auth`）
- 方案二：`src/modules/auth/{domain,application,infrastructure}/`（`AuthService` 中直接调用 `PrismaService` 的部分被拆到 infrastructure 层的 Repository 实现里）
- 方案三：`src/contexts/identity/auth/`（`identity` 是限界上下文，`auth` 是其中一个能力模块）

具体目录示例见各方案文档。
