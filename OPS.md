<p align="center">English | <a href="./OPS.zh-CN.md">简体中文</a></p>

# Operations Guide (Debian)

How to stand this project up on a fresh Debian host (bare metal, VM, or WSL2) using Docker Compose. This is the deployment path that has been verified end-to-end; for local development without Docker, see [README.md](./README.md).

## 1. Prerequisites

- Debian 11 (bullseye), 12 (bookworm), or 13 (trixie), `amd64` or `arm64`
- A user with `sudo` privileges
- Outbound internet access (to pull apt packages and Docker images)

**WSL2 only**: Docker needs a running init system. Make sure `/etc/wsl.conf` has:

```ini
[boot]
systemd=true
```

Then restart the WSL2 distro (`wsl --shutdown` from Windows, or restart the terminal) before continuing.

## 2. Install Docker Engine

Docker's official Debian apt repository supports bullseye/bookworm/trixie; the snippet below picks up the running codename automatically.

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

Let your user run `docker` without `sudo`:

```bash
sudo usermod -aG docker "$USER"
```

Group membership only takes effect in a **new** login session — log out/in, open a new terminal, or run `newgrp docker`.

Make sure the daemon is enabled and running (on WSL2 with `systemd=true` this is automatic on install; verify anyway):

```bash
sudo systemctl enable --now docker
```

Verify:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 3. Get the code and configure environment

```bash
git clone <repo-url> my-nest-demo
cd my-nest-demo
cp .env.example .env
```

Edit `.env` and at minimum change `JWT_SECRET` before running anything beyond local testing. Key variables consumed by `docker-compose.yml`:

| Variable | Used by | Default |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` service, app `DATABASE_URL` | `postgres` / `postgres` / `app_db` |
| `PORT` | host port mapped to the app container | `3000` |
| `JWT_SECRET` | app | must be overridden |

`DATABASE_URL` and `REDIS_HOST` are overridden inside `docker-compose.yml` to point at the `postgres`/`redis` service names — you don't need to edit those two for the Docker Compose path.

## 4. Build and start

```bash
docker compose up -d --build
```

This builds the app image (multi-stage: install deps → `prisma generate` → `nest build` → slim runtime image) and starts three containers: `postgres`, `redis`, `app`. On startup the app container runs `prisma migrate deploy` automatically before starting the server — no manual migration step needed.

## 5. Verify

```bash
docker compose ps
curl -s http://localhost:3000/api
curl -s http://localhost:3000/health
```

- Swagger UI: http://localhost:3000/docs
- Health check: http://localhost:3000/health

## 6. Common operations

```bash
# tail logs
docker compose logs -f app

# restart just the app (e.g. after editing .env)
docker compose restart app

# rebuild after a code change and restart
docker compose up -d --build app

# stop everything, keep volumes (data persists)
docker compose stop

# stop and remove containers/network, keep volumes
docker compose down

# stop and also wipe the Postgres volume (destructive — deletes all data)
docker compose down -v

# shell into the running app container
docker compose exec app sh

# run a one-off Prisma command against the compose network
docker compose exec app ./node_modules/.bin/prisma migrate status
```

## 7. Troubleshooting

**`permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`**
Your shell session predates being added to the `docker` group. Open a new terminal/session (or `newgrp docker`), or prefix commands with `sudo` in the meantime.

**`docker.service` inactive / `Cannot connect to the Docker daemon`**
```bash
sudo systemctl status docker
sudo systemctl enable --now docker
```
On WSL2, also confirm `systemd=true` is set in `/etc/wsl.conf` (see step 1) — without it, systemd-managed services including Docker never start.

**Port `3000` (or `5432`/`6379`) already in use**
Something else on the host is bound to that port. Either stop it, or set `PORT` in `.env` to remap the app's host port (Postgres/Redis ports are not published to the host by default, only reachable from other containers on the compose network).

**App container restarts in a loop right after `up`**
Check `docker compose logs app` first — most causes are a missing/invalid `.env` value or the database not yet being reachable (the `depends_on: condition: service_healthy` should prevent this, but a slow first boot can still race). Wait a few seconds and re-check `docker compose ps`.

## 8. Disk space budget

Rough sizing for planning a fresh host/VM:

| Item | Size |
|---|---|
| Docker Engine itself | ~0.5–1 GB |
| `postgres:16-alpine` + `redis:7-alpine` images | ~300 MB |
| App image (Node base + prod deps + build output) | ~500 MB–1 GB |
| Postgres data volume | grows with usage |

Budget **at least 3–4 GB** free disk for a first-time install and build.

## 9. Uninstall

```bash
docker compose down -v            # stop containers, remove volumes (destroys DB data)
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc
```
