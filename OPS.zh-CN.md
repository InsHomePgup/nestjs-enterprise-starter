<p align="center"><a href="./OPS.md">English</a> | 简体中文</p>

# 运维文档（Debian）

如何在全新的 Debian 主机（物理机、虚拟机或 WSL2）上，用 Docker Compose 把本项目跑起来。这是经过完整验证的部署方式；如果只是本地开发、不想用 Docker，参见 [README.zh-CN.md](./README.zh-CN.md)。

## 1. 前置条件

- Debian 11（bullseye）、12（bookworm）或 13（trixie），`amd64` 或 `arm64`
- 具备 `sudo` 权限的用户
- 能访问外网（拉取 apt 包和 Docker 镜像）

**仅 WSL2 需要**：Docker 依赖一个运行中的 init 系统。确认 `/etc/wsl.conf` 中包含：

```ini
[boot]
systemd=true
```

改完后需要重启这个 WSL2 发行版（在 Windows 侧执行 `wsl --shutdown`，或重启终端）才能生效，再继续下面的步骤。

## 2. 安装 Docker Engine

Docker 官方 Debian apt 源同时支持 bullseye/bookworm/trixie；下面的命令会自动取当前系统的 codename。

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

让当前用户不用 `sudo` 也能跑 `docker`：

```bash
sudo usermod -aG docker "$USER"
```

组权限只有在**新的登录会话**里才会生效——重新登录、开一个新终端，或者执行 `newgrp docker`。

确认 daemon 已启用并在运行（WSL2 下如果 `systemd=true` 已配置好，安装时会自动启动，这里再确认一遍）：

```bash
sudo systemctl enable --now docker
```

验证：

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 3. 拉取代码并配置环境变量

```bash
git clone <repo-url> my-nest-demo
cd my-nest-demo
cp .env.example .env
```

编辑 `.env`，至少要把 `JWT_SECRET` 改掉再进行本地测试之外的任何使用。`docker-compose.yml` 会用到的关键变量：

| 变量 | 用途 | 默认值 |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` 服务，以及应用的 `DATABASE_URL` | `postgres` / `postgres` / `app_db` |
| `PORT` | 映射到宿主机的应用端口 | `3000` |
| `JWT_SECRET` | 应用鉴权 | 必须自行覆盖 |

`DATABASE_URL` 和 `REDIS_HOST` 在 `docker-compose.yml` 里已经被覆盖为指向 `postgres`/`redis` 服务名——走 Docker Compose 部署时这两项不需要你手动改。

## 4. 构建并启动

```bash
docker compose up -d --build
```

会构建应用镜像（多阶段：装依赖 → `prisma generate` → `nest build` → 精简运行时镜像），并启动三个容器：`postgres`、`redis`、`app`。应用容器启动时会自动先跑 `prisma migrate deploy` 再启动服务，不需要手动执行迁移。

## 5. 验证

```bash
docker compose ps
curl -s http://localhost:3000/api
curl -s http://localhost:3000/health
```

- Swagger 文档：http://localhost:3000/docs
- 健康检查：http://localhost:3000/health

## 6. 常用运维操作

```bash
# 查看实时日志
docker compose logs -f app

# 只重启 app（比如改完 .env 之后）
docker compose restart app

# 改完代码后重新构建并重启
docker compose up -d --build app

# 停止所有容器，保留数据卷（数据不丢）
docker compose stop

# 停止并删除容器/网络，保留数据卷
docker compose down

# 停止并连数据卷一起清掉（危险操作——会删掉所有数据）
docker compose down -v

# 进入正在运行的 app 容器
docker compose exec app sh

# 在 compose 网络里跑一次性的 Prisma 命令
docker compose exec app ./node_modules/.bin/prisma migrate status
```

## 7. 故障排查

**`permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`**
当前 shell 会话是在把用户加入 `docker` 组之前打开的。开一个新终端/新会话（或执行 `newgrp docker`），临时也可以在命令前加 `sudo`。

**`docker.service` 未激活 / `Cannot connect to the Docker daemon`**
```bash
sudo systemctl status docker
sudo systemctl enable --now docker
```
如果是 WSL2，还要确认 `/etc/wsl.conf` 里配置了 `systemd=true`（见第 1 步）——没配的话，包括 Docker 在内的所有 systemd 托管服务都不会启动。

**端口 `3000`（或 `5432`/`6379`）已被占用**
说明宿主机上已经有其他进程占用了这个端口。要么停掉那个进程，要么在 `.env` 里改 `PORT` 把应用的宿主机端口换一个（Postgres/Redis 默认不对外发布端口，只有同一 compose 网络里的容器能访问）。

**`up` 之后 app 容器一直重启**
先看 `docker compose logs app`，常见原因是 `.env` 里某个值缺失/不对，或者数据库还没就绪（`depends_on: condition: service_healthy` 理论上能防住这个问题，但首次启动较慢时仍可能出现竞态）。等几秒再看一次 `docker compose ps`。

## 8. 磁盘空间预估

给新主机/虚拟机做容量规划时的粗略参考：

| 项目 | 大小 |
|---|---|
| Docker Engine 本体 | 约 0.5–1 GB |
| `postgres:16-alpine` + `redis:7-alpine` 镜像 | 约 300 MB |
| 应用镜像（Node 基础镜像 + 生产依赖 + 构建产物） | 约 500 MB–1 GB |
| Postgres 数据卷 | 随使用量增长 |

首次安装 + 构建，建议预留**至少 3–4 GB** 可用磁盘空间。

## 9. 卸载

```bash
docker compose down -v            # 停止容器并删除数据卷（会销毁数据库数据）
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc
```
