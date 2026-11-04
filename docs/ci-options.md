# 可选 CI 方案

本文列出后端项目常用的 CI/CD 流水线，供按需挑选。当前仓库只启用了基础 CI 和发版流程，其余各项都是**可选的**，加不加、什么时候加由你决定。

> 约定：本仓库的工作流默认**只能手动触发**（`workflow_dispatch`），不会因为 push 或 PR 自动运行。下文的示例也都按手动触发来写。如果某项需要自动运行，文中会单独说明。

---

## 0. 现状

| 工作流 | 文件 | 触发方式 | 内容 |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | 手动 | Biome 检查 → 生成 Prisma client → 执行迁移 → 检查迁移是否漏提交 → 单元测试 → e2e 测试（使用真实的 Postgres 和 Redis）→ 构建 |
| Release | `.github/workflows/release.yml` | 手动 | release-it：lint、单测、构建 → 升级版本号 → 生成 CHANGELOG → 打 tag → 创建 GitHub Release |

### 如何手动触发

```bash
gh workflow run CI                  # 在 main 上运行 CI
gh workflow run CI --ref feat/xxx   # 在指定分支上运行
gh run watch                        # 实时查看运行进度
```

也可以在 GitHub 网页上操作：**Actions → 选择工作流 → Run workflow**。

> 注意：GitHub 上被停用（disabled）的工作流不能手动触发。CI 目前处于停用状态，需要先执行一次 `gh workflow enable CI`。CI 现在只有 `workflow_dispatch` 一种触发方式，启用之后也不会自动运行。

### 如果以后想改回自动触发

在 `ci.yml` 的 `on:` 下面加上：

```yaml
on:
  workflow_dispatch:
  push:
    branches: [main]
  pull_request:
```

---

## 总览

| # | 名称 | 解决什么问题 | 成本 | 推荐度 |
|---|---|---|---|---|
| 1 | Docker 镜像构建检查 | Dockerfile 坏了，要等到部署时才发现 | 低 | ⭐⭐⭐ |
| 2 | 镜像发布到 GHCR | 服务器每次部署都要现场构建，慢且结果不可复现 | 低 | ⭐⭐⭐ |
| 3 | Trivy 镜像漏洞扫描 | 基础镜像或依赖中存在已知 CVE | 低 | ⭐⭐ |
| 4 | 依赖更新与审计 | 依赖过旧或带有漏洞 | 低（但会持续产生 PR） | ⭐⭐⭐ |
| 5 | CodeQL 代码扫描 | 注入、路径遍历等安全问题 | 低（公开仓库免费） | ⭐⭐ |
| 6 | 测试覆盖率阈值 | 测试越写越少 | 低 | ⭐⭐ |
| 7 | OpenAPI 契约检查 | 后端改了接口，前端却不知道 | 中 | ⭐⭐⭐（前后端分仓时） |
| 8 | commitlint | commit 格式不规范，CHANGELOG 漏掉内容 | 低 | ⭐⭐ |
| 9 | 迁移 SQL 安全检查 | 上线执行迁移时锁表或丢数据 | 低 | ⭐ |
| 10 | 自动部署 | 发版后还要手动登录服务器部署 | 中 | 视部署方式而定 |

我建议按下面的顺序加：先加 1、2、4（不做就容易出问题，而且接入成本很低），再加 7 和 8（服务于前后端通信和发版），其余的按需添加。

---

## 1. Docker 镜像构建检查

**解决的问题**：CI 现在只验证了 `nest build`，没有验证 Dockerfile。依赖安装、`prisma generate`、文件权限、启动路径这些问题，都要等到真正部署时才会暴露。这个项目之前就出现过镜像权限和启动路径的 bug。

**做法**：在 CI 里实际构建一次镜像，但不推送。可以直接加在 `ci.yml` 里作为一个 job，也可以单独建一个工作流。

```yaml
  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**进阶**：构建完成后，用 `docker run` 配合 Postgres 服务实际启动容器，再请求 `/health` 做冒烟测试。这样连"迁移 → seed → 启动"整条启动流程也一起验证了。

---

## 2. 镜像发布到 GHCR

**解决的问题**：现在部署时要在服务器上执行 `docker compose up --build` 现场构建，速度慢、占用服务器资源，同一个版本在不同机器上构建出来的结果也可能不一样。

**做法**：发版之后把镜像推送到 GitHub Container Registry（GHCR，公开仓库免费），服务器直接拉取指定版本。

推荐的触发方式有两种，都不需要手动多点一次：

- 跟在 Release 后面：`on: release: types: [published]`，发版完成后自动推送镜像；
- 或者保持手动：`workflow_dispatch`，手动输入要构建的 tag。

```yaml
name: Publish Image

on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**配套改动**：`docker-compose.yml` 里的 `app` 服务从 `build: .` 改为 `image: ghcr.io/<owner>/nestjs-enterprise-starter:${APP_VERSION:-latest}`。部署和回滚都只需要改版本号。

**注意**：如果服务器是 ARM 架构，需要加上 `platforms: linux/amd64,linux/arm64`，构建时间会变长。

---

## 3. Trivy 镜像漏洞扫描

**解决的问题**：`node:24-alpine` 基础镜像和 npm 依赖里可能有已知漏洞（CVE），光看代码发现不了。

**做法**：镜像构建出来以后用 [Trivy](https://github.com/aquasecurity/trivy-action) 扫描。建议和第 2 项放在同一个工作流里，推送之前先扫描。

```yaml
      - uses: aquasecurity/trivy-action@<固定到某个具体版本>
        with:
          image-ref: ghcr.io/${{ github.repository }}:latest
          severity: CRITICAL,HIGH
          ignore-unfixed: true   # 只报告已经有修复版本的漏洞，减少噪音
          exit-code: '1'         # 发现漏洞时让流水线失败；如果只想看报告，改成 '0'
```

**注意**：action 的版本号请以官方 README 为准，并固定到具体版本，不要用浮动的 tag。刚接入时建议先设为 `exit-code: '0'`，观察一段时间再决定要不要让它阻断流水线。

---

## 4. 依赖更新与审计

**解决的问题**：依赖会逐渐过时，也会陆续曝出漏洞。手动跟进很容易遗漏。

**方案 A：Renovate（推荐）**

- 安装 [Renovate GitHub App](https://github.com/apps/renovate)，在仓库根目录加一个 `renovate.json`：

  ```json
  {
    "$schema": "https://docs.renovatebot.com/renovate-schema.json",
    "extends": ["config:recommended", ":semanticCommitTypeAll(chore)"],
    "schedule": ["before 9am on monday"],
    "packageRules": [
      { "matchUpdateTypes": ["minor", "patch"], "groupName": "非 major 依赖" },
      { "matchPackageNames": ["/^@nestjs\\//"], "groupName": "NestJS" },
      { "matchPackageNames": ["prisma", "/^@prisma\\//"], "groupName": "Prisma" }
    ]
  }
  ```

- 会按计划**自动开 PR**，但不会自动合并，合不合由你决定。
- 相比 Dependabot 的优点：支持分组（NestJS 全家桶在一个 PR 里一起升级）、支持 pnpm workspace、可以配置时间表。

**方案 B：Dependabot**：GitHub 自带，在 `.github/dependabot.yml` 里配置即可。功能比 Renovate 简单，分组能力较弱。

**审计**：在 CI 里加一步 `pnpm audit --audit-level=high`，有高危漏洞时让 CI 失败。

**注意**：这类工具的本质就是机器人**定期自动**提 PR，和"只手动触发"的约定不同。如果不想要自动 PR，可以只保留 `pnpm audit` 这一步，放在手动 CI 里跑。

---

## 5. CodeQL 代码扫描

**解决的问题**：静态分析出 SQL 注入、路径遍历、不安全的正则（ReDoS）、敏感信息泄漏等问题。

**做法**：最简单的方式是在 GitHub 仓库 **Settings → Code security → Code scanning → Default setup** 一键开启，不需要写任何文件。

想手动控制运行时机，可以写成工作流：

```yaml
name: CodeQL

on:
  workflow_dispatch:

permissions:
  security-events: write
  contents: read

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

扫描结果会出现在仓库的 **Security → Code scanning** 页面。公开仓库免费。

---

## 6. 测试覆盖率阈值

**解决的问题**：没有约束时，新代码可能不写测试，覆盖率会逐渐下降。

**做法**：在 `package.json` 的 `jest` 配置里加上阈值，`pnpm test:cov` 低于阈值时直接失败：

```json
"coverageThreshold": {
  "global": { "branches": 70, "functions": 80, "lines": 80, "statements": 80 }
},
"coveragePathIgnorePatterns": ["/generated/", "\\.module\\.ts$", "main\\.ts$", "\\.dto\\.ts$"]
```

然后把 CI 里的 `pnpm test` 换成 `pnpm test:cov`。如果想在 PR 里看到覆盖率变化，可以接入 Codecov（公开仓库免费）。

**注意**：阈值要先按当前的实际覆盖率来设，以后再逐步调高，否则一开启 CI 就会失败。

---

## 7. OpenAPI 契约检查（前后端通信）

**解决的问题**：这就是之前定下的"用 openapi.json 和前端通信"方案在 CI 中的部分。目的是保证后端每次改动接口，前端都能知道，而且破坏性改动不会被悄悄合并进去。

**做法**（属于第四步，依赖 `pnpm openapi:export` 脚本，目前还没有实现）：

1. CI 里执行 `pnpm openapi:export`，生成 `openapi.json`。
2. **漂移检查**：如果生成的结果和仓库里提交的 `openapi.json` 不一样，说明改了接口但没有更新契约文件，CI 失败。
3. **破坏性改动检查**：用 [oasdiff](https://github.com/oasdiff/oasdiff) 和上一个 release 的 `openapi.json` 对比。如果出现删除字段、修改类型、新增必填参数等情况，而 commit 又没有用 `feat!:` 声明，CI 失败。
4. **作为发版附件**：在 Release 工作流里把 `openapi.json` 作为附件上传到 GitHub Release，前端按版本号拉取。

```bash
# 本地也可以直接跑：对比上一个版本和当前版本，只输出破坏性改动
oasdiff breaking base/openapi.json openapi.json --fail-on ERR
```

---

## 8. commitlint

**解决的问题**：CHANGELOG 完全依赖 commit message 的格式。格式写错的 commit（比如 `更新代码`）会被 CHANGELOG 直接**忽略**，这一点在 v1.0.0 里已经发生过：最早的 `init` commit 就没有出现在 CHANGELOG 中。

**做法（两层）**：

- **本地**：在提交时就拦住，比 CI 发现得更早。用 husky 加 commitlint，在 commit-msg 钩子里检查：

  ```js
  // commitlint.config.js
  module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
      'subject-case': [0],          // 允许中文描述
      'header-max-length': [2, 'always', 120],
      'body-empty': [2, 'always'],  // 和 CLAUDE.md 一致：单行，不写正文
    },
  };
  ```

- **CI**：在手动 CI 里检查 `上一个 tag..HEAD` 之间的所有 commit，在发版前兜底。

---

## 9. 迁移 SQL 安全检查

**解决的问题**：有些迁移在测试库上没问题，到了数据量大的生产库就会出事，比如：

- 给大表加 `NOT NULL` 列但没有默认值，或者直接建索引，会长时间锁表；
- 删列或改列类型，旧版本的代码还在运行时会出错；
- 重命名列，Prisma 会生成"先删除再新增"的 SQL，导致**数据丢失**。

**做法**：用 [squawk](https://github.com/sbdchd/squawk) 检查新增的 `prisma/migrations/*/migration.sql`：

```bash
npx squawk-cli prisma/migrations/*/migration.sql
```

只检查本次新增的迁移就够了，历史迁移不用重复检查。数据量小的项目可以暂时不加。

---

## 10. 自动部署

**解决的问题**：发版之后还要手动 SSH 到服务器、拉代码、重启服务。

**做法**：要先完成第 2 项（镜像发布）。部署工作流手动触发，输入要部署的版本号：

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      version:
        description: '要部署的版本，如 1.2.0'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # 可以在 GitHub 上为该环境设置"需要审批"
    steps:
      - uses: appleboy/ssh-action@<固定到某个具体版本>
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/nestjs-enterprise-starter
            APP_VERSION=${{ inputs.version }} docker compose pull app
            APP_VERSION=${{ inputs.version }} docker compose up -d app
            sleep 10 && curl -fsS http://localhost:3000/health
```

**注意**：

- 服务器上使用专门的部署用户和独立的 SSH key，只给它操作 docker 的权限。
- 利用 GitHub 的 `environment` 功能，可以设置"部署前需要审批"，防止误操作。
- 回滚的方法：用旧版本号再执行一次这个工作流。
- 如果以后迁到 k8s 或云厂商的托管服务，这一项要换成相应的部署方式（Helm、ArgoCD、云厂商的 action 等）。

---

## 推荐组合

| 阶段 | 包含 | 说明 |
|---|---|---|
| 最小可用（现状） | CI + Release | 保证代码正确，发版规范 |
| 推荐 | 再加 1 + 2 + 4 | 镜像可以复现、依赖可以持续更新 |
| 前后端协作 | 再加 7 + 8 | 接口契约可控，CHANGELOG 不漏内容 |
| 完整 | 再加 3 + 5 + 6 + 9 + 10 | 安全扫描、质量门槛、一键部署 |
