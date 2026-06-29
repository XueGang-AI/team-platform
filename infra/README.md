# 本地基础设施

> 本文件描述 team-platform 本地开发基础设施。
> 实际编排定义在仓库根目录的 [`compose.yaml`](../compose.yaml)，本文件仅作说明，不重复配置。

## 范围

本地基础设施包含通用控制面依赖说明与 Phase 4 可观测性数据面骨架。默认 `docker compose up -d` 只启动可观测性组件，日常开发使用通用 PostgreSQL/Redis 服务。

| 组件       | 镜像                 | 宿主端口 | 容器端口 | 数据卷                        | Healthcheck                                    |
| ---------- | -------------------- | -------- | -------- | ----------------------------- | ---------------------------------------------- |
| PostgreSQL | 通用服务 | `15432` | - | - | - |
| Redis      | 通用服务 | `16379` | - | - | - |
| OTel Collector | `otel/opentelemetry-collector-contrib` | `3224/3225/3226` | `4317/4318/9464` | - | - |
| Prometheus | `prom/prometheus` | `3221` | `3221` | `team-platform-prometheus-data` | - |
| Loki | `grafana/loki` | `3222` | `3222` | - | - |
| Tempo | `grafana/tempo` | `3223/3227` | `3223/4317` | `team-platform-tempo-data` | - |
| Grafana | `grafana/grafana` | `3220` | `3220` | `team-platform-grafana-data` | - |

> PostgreSQL 使用 `127.0.0.1:15432/team_platform`，Redis 使用 `127.0.0.1:16379`，Redis 键前缀为 `team_platform:`。

- 如需临时启用项目专属数据库容器，可执行 `docker compose --profile local-db up -d`；默认启动不会创建或暴露它们。除非专门调试隔离数据库，不建议使用该 profile。

可观测性组件只作为外部数据面骨架提供，平台控制面只保存项目维度、跳转链接和治理元数据，不复制原始日志、指标和 Trace。

Tempo 本地容器使用 `user: '0'` 写入 `team-platform-tempo-data` 卷，避免 macOS Docker Desktop 下 `/tmp/tempo` 数据目录权限导致容器反复重启。

## 前置条件

- Docker（含 Docker Compose v2，`docker compose` 子命令）
- Node.js 24（见根目录 `.nvmrc`）
- pnpm 11.7.0（见根目录 `package.json` 的 `packageManager` 字段）

## 启停命令

基础设施启停通过根目录 `package.json` 暴露的脚本，等价于直接调用 `docker compose`：

| 命令              | 等价操作               | 说明                             |
| ----------------- | ---------------------- | -------------------------------- |
| `pnpm dev:infra`  | `docker compose up -d` | 后台启动本地可观测性组件             |
| `pnpm stop:infra` | `docker compose down`  | 停止并移除容器（**保留数据卷**） |

启动后可用 `docker compose ps` 查看状态，或 `docker compose logs -f` 跟随日志。

## 连接配置

启动基础设施后，将根目录 [`.env.example`](../.env.example) 复制为 `.env` 并按需调整。本地连接串已内置占位值：

```dotenv
DATABASE_URL=postgresql://team_platform:team_platform@127.0.0.1:15432/team_platform?schema=public
REDIS_URL=redis://127.0.0.1:16379
REDIS_KEY_PREFIX=team_platform:
```

- `DATABASE_URL`：控制面 PostgreSQL 主库，Prisma（schema 位于 `apps/api/prisma`）与 API 运行时使用。
- `REDIS_URL`：通用 Redis。
- `REDIS_KEY_PREFIX`：当前项目的 Redis 键前缀，避免与其他项目共用 Redis 时互相污染。

> 集成测试连接 `DATABASE_URL` 指向的 `team_platform` 主库，不使用独立测试库。如需隔离测试数据可再增加 `TEST_DATABASE_URL` 与独立测试库。

## 凭据说明

`compose.yaml` 与 `.env.example` 中的用户名 / 密码均为 **本地开发占位值**（`team_platform`），仅用于本地与 CI，**绝非生产密钥**。生产环境凭据通过外部 Secret Store 注入，不入库不入仓库，详见 [`docs/06-security-principles.md`](../docs/06-security-principles.md)。

## 数据持久化与清理

仅在启用 `local-db` profile 时，项目专属 PostgreSQL 与 Redis 数据会分别持久化到命名数据卷：

- `team-platform-postgres-data`
- `team-platform-redis-data`

`pnpm stop:infra`（`docker compose down`）**只移除容器，保留数据卷**，下次启用相同 profile 时数据仍在。日常默认模式使用通用 PostgreSQL/Redis 服务，不依赖这些项目专属数据卷。

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
| Phase 4（已完成基础骨架） | Loki / Prometheus / Tempo / Grafana / OTel Collector 等可观测性组件 |

后续阶段引入新组件时，应在本文件与 `compose.yaml` 同步更新，并保持文档与真实状态一致。
