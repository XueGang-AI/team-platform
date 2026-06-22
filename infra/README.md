# 本地基础设施（Phase 1）

> 本文件描述 team-platform 在 **Phase 1** 阶段的本地开发基础设施。
> 实际编排定义在仓库根目录的 [`compose.yaml`](../compose.yaml)，本文件仅作说明，不重复配置。

## 范围

Phase 1 本地基础设施 **只包含** 两个组件：

| 组件       | 镜像                 | 宿主端口 | 容器端口 | 数据卷                        | Healthcheck                                    |
| ---------- | -------------------- | -------- | -------- | ----------------------------- | ---------------------------------------------- |
| PostgreSQL | `postgres:16-alpine` | `5433`   | `5432`   | `team-platform-postgres-data` | `pg_isready -U team_platform -d team_platform` |
| Redis      | `redis:7-alpine`     | `6380`   | `6379`   | `team-platform-redis-data`    | `redis-cli ping`                               |

> 宿主端口使用 5433/6380（容器内仍为 5432/6379），用于避开常见本机已安装的 PostgreSQL(5432) / Redis(6379) 占用冲突。CI 环境使用 GitHub Actions service container，端口为默认 5432/6379，无冲突。

- 容器名：`team-platform-postgres`、`team-platform-redis`。
- 两者均配置 `restart: unless-stopped` 与 healthcheck（间隔 5s，超时 5s，重试 10 次）。
- Redis 启动命令为 `redis-server --save 60 1 --loglevel warning`（开启 RDB 持久化）。

可观测性组件（Loki / Prometheus / Tempo / Grafana / OTel Collector / 对象存储 等）**在 Phase 4 才引入**，本阶段不包含，请勿在本阶段向 `compose.yaml` 添加这些服务。

## 前置条件

- Docker（含 Docker Compose v2，`docker compose` 子命令）
- Node.js 24（见根目录 `.nvmrc`）
- pnpm 11.7.0（见根目录 `package.json` 的 `packageManager` 字段）

## 启停命令

基础设施启停通过根目录 `package.json` 暴露的脚本，等价于直接调用 `docker compose`：

| 命令              | 等价操作               | 说明                             |
| ----------------- | ---------------------- | -------------------------------- |
| `pnpm dev:infra`  | `docker compose up -d` | 后台启动 PostgreSQL 与 Redis     |
| `pnpm stop:infra` | `docker compose down`  | 停止并移除容器（**保留数据卷**） |

启动后可用 `docker compose ps` 查看状态，或 `docker compose logs -f` 跟随日志。

## 连接配置

启动基础设施后，将根目录 [`.env.example`](../.env.example) 复制为 `.env` 并按需调整。Phase 1 所需的连接串已内置占位值：

```dotenv
DATABASE_URL=postgresql://team_platform:team_platform@localhost:5433/team_platform?schema=public
REDIS_URL=redis://localhost:6380
```

- `DATABASE_URL`：控制面 PostgreSQL 主库，Prisma（schema 位于 `apps/api/prisma`）与 API 运行时使用。`compose.yaml` 的 `POSTGRES_DB=team_platform` 会自动创建该库。
- `REDIS_URL`：本地 Redis。

> Phase 1 集成测试连接 `DATABASE_URL` 指向的 `team_platform` 主库，不使用独立测试库。Phase 2 引入业务表与迁移后，如需隔离测试数据再增加 `TEST_DATABASE_URL` 与独立测试库。

## 凭据说明

`compose.yaml` 与 `.env.example` 中的用户名 / 密码均为 **本地开发占位值**（`team_platform`），仅用于本地与 CI，**绝非生产密钥**。生产环境凭据通过外部 Secret Store 注入，不入库不入仓库，详见 [`docs/06-security-principles.md`](../docs/06-security-principles.md)。

## 数据持久化与清理

PostgreSQL 与 Redis 的数据分别持久化到命名数据卷：

- `team-platform-postgres-data`
- `team-platform-redis-data`

`pnpm stop:infra`（`docker compose down`）**只移除容器，保留数据卷**，下次启动数据仍在。

> **破坏性操作警告**：`docker compose down -v` 会**同时删除数据卷**，PostgreSQL 与 Redis 中的所有本地数据将被永久清除且不可恢复。仅在需要重置本地环境时使用，执行前务必确认无需保留的数据。本阶段不提供数据备份脚本。

如需彻底清理本地基础设施：

```bash
# 1. 停止并移除容器（保留数据卷）
pnpm stop:infra

# 2.（可选，破坏性）删除数据卷，重置所有本地数据
docker compose down -v
```

## 与 CI 的关系

GitHub Actions CI（`.github/workflows/ci.yml`）在集成测试 job 中使用等价的 service container（`postgres:16-alpine` + `redis:7-alpine`）并设置相同的连接串，确保本地与 CI 环境一致。CI 中的凭据同样使用 `team_platform` 占位值，不使用任何生产密钥。

## 后续阶段

| 阶段            | 基础设施增量                                                        |
| --------------- | ------------------------------------------------------------------- |
| Phase 1（已完成） | PostgreSQL + Redis                                                  |
| Phase 4（规划） | Loki / Prometheus / Tempo / Grafana / OTel Collector 等可观测性组件 |

后续阶段引入新组件时，应在本文件与 `compose.yaml` 同步更新，并保持文档与真实状态一致。
