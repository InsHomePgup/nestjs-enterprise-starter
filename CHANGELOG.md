# 更新日志 / Changelog

本文件由 release-it 根据 Conventional Commits 自动生成，请勿手动编辑。

## [1.1.0](https://github.com/InsHomePgup/nestjs-enterprise-starter/compare/v1.0.0...v1.1.0) (2026-11-04)

### 新功能 Features

* 启用 Swagger 插件，补齐接口注释、响应类型与错误码文档，新增 @Auth 装饰器与文档质量检查 ([2dc47ca](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/2dc47ca5c179c5b5b00e2be513e41db5dd2556d1))
* 新增 openapi:export 导出接口契约，CI 校验契约漂移与破坏性变更，发版附带 openapi.json ([7f15e55](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/7f15e557ff6cdb4258723531547479b4bd99660c))
* 日志脱敏与请求上下文，每个请求输出一条带 requestId、userId、errorCode 的访问日志 ([c93055d](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/c93055d3f04a09734d5eac03bf292e97fde2d796))
* 错误码注册表与自动生成的错误码文档，细分认证错误码，校验与唯一冲突返回字段级 details ([2964513](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/296451368df93b248e9c1e9640b6a6c3d063d41a))

### 问题修复 Bug Fixes

* 健康检查增加超时，依赖不可达时返回 down 而不是一直挂起 ([238565c](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/238565c836d677616723d0e3d16d883703c7c8f6))

### 文档 Documentation

* 新增接口开发规范与功能覆盖清单，README 补充接口契约与错误码说明 ([037acdb](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/037acdb48a4cc5c05a7acf2ae0f78d0d3eb1d884))

### 持续集成 CI

* CI 改为仅手动触发，新增可选 CI 方案文档 ([5ab4319](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/5ab43196db692e4cb42b3c9b8d6765f2f23c5b8d))

## 1.0.0 (2026-11-04)

### 新功能 Features

* 实现 User CRUD、RBAC、Auth 令牌刷新与密码找回流程 ([03bc2ef](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/03bc2efd44f9a557dd2f3a33fe882f396626a493))
* 按 NODE_ENV 加载对应环境的 env 配置文件 ([da1eaa8](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/da1eaa8faeee08b8933d60681a3290a20763a7dd))
* 搭建企业级 NestJS 启动模板（Prisma+PostgreSQL、Redis 缓存、JWT 鉴权骨架、健康检查、日志、限流、Docker） ([f324e55](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/f324e55a517c0064ea8c48b133aca05f64db974d))
* 新增 user 模块并让 auth 通过仓储访问用户数据 ([e1426f1](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/e1426f1cbd57deb7f5555be01b71fba1a988ffe9))
* 新增初始数据库迁移与幂等的管理员 seed 脚本，容器启动时自动迁移并 seed ([013f681](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/013f6811d8b74cb95a7615edc62be266ea4847ac))
* 添加 CI 流水线、统一响应拦截器与请求追踪 ID ([49dea73](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/49dea733c5ec1261dab2e5b7f01cb7b442441f12))
* 生产环境拒绝少于 32 位或仍为占位值的 JWT_SECRET ([c2d691f](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/c2d691fda3f262e3fa2ff6812d9492364ae788c3))
* 统一错误响应结构（message 扁平化、新增 details 与通用错误码）并将 Prisma 异常映射为 409/404 ([3b6a3a5](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/3b6a3a53704bee0a8acb96bfb66aedec30a25b13))
* 补齐 API 前缀/Swagger 开关/应用信息/bcrypt 强度环境变量并接入代码 ([ede2afb](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/ede2afbe880d040084f8668c90cdb93a9766c9c0))

### 问题修复 Bug Fixes

* 修复刷新令牌与重置密码的并发竞态，重置密码改为事务执行，并发注册返回 AUTH_EMAIL_TAKEN ([30aac41](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/30aac417f968c406a4de693e1198ce00147f684d))
* 修复生产环境 Docker 镜像权限与启动路径问题 ([fcc7d35](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/fcc7d357e193abd1c04050c82c4163e53d9efcd6))
* 补全目录迁移后遗漏的导入路径修正 ([1fff4bd](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/1fff4bd29b776390a8966da9da97e52e56fee8b9))

### 重构 Refactoring

* 抽取 configureApp 供 main.ts 与 e2e 共用，e2e 覆盖 helmet 等完整 HTTP 管道 ([edc926e](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/edc926ed6a7871f16d1d8e2035e2feeee98846af))
* 拆分 prisma schema 为多文件并迁移配置到根目录 ([6e800f2](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/6e800f290d8645fc8dc0713ccdb38b70aee0c3fa))

### 文档 Documentation

* 新增 Debian 运维文档并在 README 中添加入口 ([56cb7a9](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/56cb7a96bb0622671442b6092f5bbd2c0865a76f))
* 新增中文版 README 并互相链接 ([30bd8ca](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/30bd8cac4a0df341fae858dbf33514302942e516))
* 更新中英文 README 与运维文档，补充迁移流程、seed、错误响应格式与生产密钥要求 ([3861292](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/3861292712f01d158b61472a4c4ba96c11d059b6))
* 添加模块化架构方案对比文档 ([1f5c831](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/1f5c831e94fbc635fbfa93caa738dd4e812403b5))
* 移除模块化架构方案文档 ([66fbe19](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/66fbe196c15422e91f465c6f230aa3838935e5bc))
* 补充 README 路线图/TODO 章节 ([9fceb2b](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/9fceb2b9bff99e318a92d0296c478f66f9b38e74))

### 构建 Build

* 移除 ESLint 与 Prettier，改用 Biome 统一 lint 与格式化 ([0368d4b](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/0368d4bdf9635bae6a85d1e69e4b889cfaa71e92))

### 持续集成 CI

* CI 改为 push/PR 自动触发，内置 Postgres 与 Redis 服务并校验迁移与 schema 一致 ([176bcc4](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/176bcc40fb21eb70f25fdf70143977834bc629ab))

### 杂项 Chores

* 接入 release-it 与 conventional-changelog 发版流程，新增手动触发的 Release 工作流 ([2e04b75](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/2e04b75c2cfcab2f83418adf318f152b71d67e8c))
* 补充 MIT LICENSE 文件 ([2edf6c6](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/2edf6c689600a2ee01030f9ece1e7556f09d6380))
* 项目更名为 nestjs-enterprise-starter 并补充 package 描述 ([d2b33a9](https://github.com/InsHomePgup/nestjs-enterprise-starter/commit/d2b33a92c6c911374ce280cf7def9194b9e961b5))
