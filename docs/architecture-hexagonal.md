# 方案二：Hexagonal / Clean Architecture（模块内分层）

## 核心思路

在方案一"按业务领域分目录"的基础上，每个模块内部再拆成三层，让业务逻辑不直接依赖 Prisma、Redis 这些具体技术实现，而是依赖自己定义的接口（Port），具体实现（Adapter）在最外层：

- **domain**：领域模型、业务规则本身，纯 TypeScript，不 import 任何 NestJS/Prisma 相关的包
- **application**：用例编排（Service/UseCase），依赖 domain 定义的接口，不知道接口背后是 Prisma 还是别的
- **infrastructure**：接口的具体实现（Repository 用 Prisma 实现、缓存用 Redis 实现），以及 Controller、Module 这些和框架强绑定的部分

这就是常说的"端口与适配器"（Ports & Adapters），业务逻辑是六边形中心，数据库/HTTP/消息队列都是外部适配器，可以互相替换。

## 目录结构示例（以 auth 模块为例）

```
src/modules/auth/
├── domain/
│   ├── user.entity.ts               # User 领域模型（不是 Prisma 生成的类型）
│   └── user.repository.ts           # interface UserRepository { findByEmail, create }
├── application/
│   ├── auth.service.ts               # 依赖 UserRepository 接口，不依赖 PrismaService
│   ├── auth.service.spec.ts          # 单测时用内存实现的 UserRepository mock，无需连数据库
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   └── jwt-payload.interface.ts
├── infrastructure/
│   ├── prisma-user.repository.ts     # implements UserRepository，内部调用 PrismaService
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts
│   └── jwt-auth.guard.ts
└── auth.module.ts                    # 在这里把 UserRepository 接口绑定到 PrismaUserRepository 实现
```

`auth.module.ts` 中通过 provider 绑定接口与实现：

```ts
@Module({
  providers: [
    AuthService,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
})
export class AuthModule {}
```

`AuthService` 的构造函数只依赖抽象的 `UserRepository`，不 import `PrismaService`：

```ts
constructor(private readonly userRepository: UserRepository) {}
```

## 优点

- `application` 层的业务逻辑可以完全脱离数据库做单元测试（用内存实现替换 Repository），测试更快、更稳定
- 更换基础设施成本低：比如把 Prisma 换成其他 ORM，只需要重写 `infrastructure` 里的 Repository 实现，`domain`/`application` 不用动
- 业务规则集中在 `domain`，不会散落在 Controller 或者被 Prisma 的数据结构"带偏"

## 缺点/局限

- 样板代码明显增多：一个简单的 CRUD 模块也要写 interface + 实现 + entity，对"快速起步模板"来说前期开发速度会变慢
- 团队需要理解依赖倒置（Dependency Inversion）等概念，上手门槛比方案一高
- 对于像 `health`、`cache` 这种纯基础设施型模块，套用这套分层没有意义，容易过度设计

## 建议的落地方式

不建议全项目所有模块都套用这套分层，更现实的做法是：

- 简单模块（health、静态配置类）保持方案一的扁平结构
- 核心业务模块（比如未来的订单、计费、库存）才引入 domain/application/infrastructure 三层
- 判断标准：这个模块的业务规则是否复杂到值得脱离数据库单独测试、是否有可能更换底层实现

## 迁移步骤（以 auth 模块为例，在方案一基础上）

1. 定义 `domain/user.repository.ts` 接口，声明 `findByEmail`、`create` 等方法
2. 把 `auth.service.ts` 中直接调用 `this.prisma.user.xxx` 的部分抽到 `infrastructure/prisma-user.repository.ts`，实现该接口
3. 修改 `AuthService` 构造函数，改为注入接口而非 `PrismaService`
4. 在 `auth.module.ts` 中用 `{ provide: UserRepository, useClass: PrismaUserRepository }` 完成绑定
5. 单元测试里用一个内存 Map 实现的 `UserRepository` 替代 Prisma，验证不再需要真实数据库
