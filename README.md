# 团队统一项目治理平台（team-platform）

> 面向团队多项目统一治理的内部开发者平台，提供项目注册、统一鉴权、可观测性、配置管理、告警、发布管理、任务中心、模型网关与成本治理等通用能力。

## 1. 项目是什么

team-platform 是团队内部的统一项目治理平台。在「超级个体」模式下，每个成员独立负责一个完整项目，技术栈各异，缺少统一的注册、监控与治理机制。本平台将分散在各项目的公共治理能力收口为一处。

## 2. 当前状态

**当前阶段：管理后台、平台 API、接入协议、治理中枢已形成本地完整成品闭环。** 本仓库从 GitHub 恢复后重建，并按阶段推进到可接入真实项目的通用治理平台。

- ✅ Phase 0：架构文档、领域模型、接入协议、技术选型、开发路线、安全原则、风险分析、ADR。
- ✅ Phase 1：pnpm workspace + Turborepo monorepo、NestJS API、Next.js 管理后台、PostgreSQL + Redis 本地基础设施、Prisma 7 driver adapter、单元 + 集成 + Playwright E2E 测试、GitHub Actions CI。
- ✅ Phase 2：项目注册、服务目录、环境、端点、manifest validate/apply、手动健康检查。
- ✅ Phase 3：本地邮箱登录、Bearer token、项目成员 RBAC、服务凭证、审计事件。
- ✅ Phase 4：可观测性入口控制面、OTel/Prometheus/Loki/Tempo/Grafana 本地编排骨架。
- ✅ Phase 5：TypeScript SDK、Python SDK、CLI。
- ✅ Phase 6-12：告警、配置/密钥、发布、任务、文件/通知/功能开关、模型网关/成本、Prompt/评测以 `GovernanceRecord` 统一控制面承载，并提供专用治理 API、CLI/SDK 调用和管理后台治理总览。
- ✅ 本地 Docker 已验证启动 PostgreSQL、Redis、OTel Collector、Prometheus、Loki、Tempo、Grafana；`manjv-studio` 已通过 `project.yaml` 接入测试。
- ⚠️ SSO、外部 Secret Store、真实通知渠道、CI/CD Webhook、对象存储和模型 Provider 属于外部配置/账号型集成，当前保留适配边界，不在仓库内写入真实配置。

## 3. 总体架构概览

平台采用**模块化单体**，**控制面与数据面分离**，**优先集成成熟开源组件而非重造基础设施**。

- 控制面（自研，PostgreSQL）：项目模型、权限、配置元数据、告警规则、发布记录、审计；
- 数据面（外部组件，Phase 4 引入）：Loki（日志）、Prometheus（指标）、Tempo（trace）、Grafana（Dashboard）、对象存储、外部 Secret Store；
- 平台只存维度关联索引与跳转链接，不复制全量数据面数据。

详细架构图见 [docs/01-architecture.md](./docs/01-architecture.md)。

## 4. 工程结构（当前）

```
team-platform/
├── apps/
│   ├── api/            # NestJS 平台 API（auth/audit/projects/observability/governance）
│   │   ├── prisma/     # Prisma schema 与迁移
│   │   └── src/        # API 模块源码
│   ├── cli/            # 平台 CLI
│   └── web/            # Next.js 管理后台
├── packages/
│   ├── contracts/      # 跨应用共享类型与常量契约
│   ├── config/         # 运行时环境变量校验（zod）
│   ├── logger/         # 结构化日志共享脱敏配置
│   ├── sdk-python/     # Python SDK
│   └── sdk-ts/         # TypeScript SDK
├── infra/
│   ├── README.md       # 本地基础设施说明
│   └── observability/  # OTel/Prometheus/Loki/Tempo/Grafana 配置
├── examples/           # manifest 示例
├── tests/
│   └── e2e/            # Playwright E2E 测试
├── docs/               # 架构文档与 ADR（含 08-repository-architecture）
├── .github/workflows/  # GitHub Actions CI
├── compose.yaml        # 本地基础设施（PostgreSQL + Redis + 可观测性组件）
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.mjs
├── .env.example
└── .nvmrc
```

> Phase 1.5 收敛要点：删除 `packages/database`（schema 下沉到 `apps/api/prisma`，单一消费者）；`packages/logger` 移除未被消费的 `createLogger` 死代码，仅保留共享脱敏路径。详见 [docs/08-repository-architecture.md](./docs/08-repository-architecture.md) 与 [ADR-0004](./docs/adr/0004-database-schema-location.md)。

## 5. 技术栈与锁定版本

见 [CLAUDE.md 技术栈表](./CLAUDE.md#5-技术栈) 与 [docs/04-technology-decisions.md](./docs/04-technology-decisions.md)。关键：Node 24、pnpm 11.7.0、Next.js 16.2.9、NestJS 11.1.27（Express adapter）、Prisma 7.8.0（driver adapter）、PostgreSQL 16、Redis 7。

## 6. 本地开发

### 6.1 前置要求

- Node.js 24（见 `.nvmrc`）
- pnpm 11.7.0（`corepack enable`）
- Docker（用于本地 PostgreSQL + Redis + 可观测性组件）

### 6.2 环境变量准备

```bash
cp .env.example .env   # 生成本地 .env（已被 .gitignore 忽略，不会提交）
```

`.env.example` 中的占位值（`team_platform`）仅用于本地开发，非生产密钥。

> **端口说明**：本地 Docker 宿主端口为 PostgreSQL **5433**、Redis **6380**（容器内仍为 5432/6379），用于避开常见本机已安装的 PostgreSQL(5432) / Redis(6379) 占用冲突。CI 环境使用 GitHub Actions service container，端口为默认 5432/6379。

### 6.3 启动总平台

```bash
pnpm platform:start   # 启动 Docker 基础设施、迁移数据库、构建并启动平台
pnpm platform:stop    # 停止 Web/API 后台会话
```

默认本地访问入口：

| 地址 | 用途 |
|------|------|
| `http://localhost:3004` | 团队项目治理平台总入口 |
| `http://localhost:3004/api/platform/*` | 管理后台同源代理到平台 API |
| `http://localhost:3002` | Grafana，可观测性工具入口，不是平台主入口 |

> 说明：Web 与 API 仍是两个运行时进程，但浏览器侧统一从 `http://localhost:3004` 进入。`3005` 默认只作为本地 API 上游端口，由 Next.js `/api/platform/*` 代理承接页面请求。

如只需要启动基础设施：

```bash
pnpm dev:infra     # docker compose up -d（启动 PostgreSQL + Redis + 可观测性组件）
pnpm stop:infra    # docker compose down（停止，保留数据卷）
```

> ⚠️ 破坏性操作：`docker compose down -v` 会删除数据卷且不可恢复，仅在你确信需要清空本地数据时使用。

### 6.4 安装依赖与生成 Prisma 客户端

```bash
pnpm install
pnpm --filter @team-platform/api db:generate   # 生成 Prisma 客户端到 apps/api/src/generated/prisma
```

### 6.5 开发模式

```bash
pnpm dev   # 同时启动 API(:3001) 与 Web(:3000)
```

开发模式仍保留默认端口，适合框架热更新；给人试用和验收时优先用 `pnpm platform:start`。

### 6.6 接入真实项目示例

仓库内提供 `examples/project-manifests/manjv-studio.yaml`，并已同步写入 `/Users/xuegang/Desktop/My Project/manjv-studio/project.yaml`。本地 API 启动后可用 CLI 校验并应用：

```bash
TOKEN=$(node apps/cli/dist/index.js login --email admin@example.com --name Admin --api http://localhost:3005 | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).token))')
node apps/cli/dist/index.js validate examples/project-manifests/manjv-studio.yaml --api http://localhost:3005
node apps/cli/dist/index.js apply examples/project-manifests/manjv-studio.yaml --api http://localhost:3005 --token "$TOKEN"
```

## 7. 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm platform:start` / `pnpm platform:stop` | 启停本地总平台入口（默认 Web 3004、API 上游 3005） |
| `pnpm dev` | 启动 API + Web 开发模式 |
| `pnpm dev:infra` / `pnpm stop:infra` | 启停本地 PostgreSQL + Redis + 可观测性组件 |
| `pnpm build` | 构建全部包（turbo） |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:integration` | 集成测试（需先 `pnpm dev:infra`） |
| `pnpm test:e2e` | Playwright E2E（需先启动 infra + API + Web） |
| `pnpm format` / `pnpm format:check` | Prettier 格式化 / 检查 |

## 8. 核心 API 端点

| 端点 | 语义 |
|------|------|
| `GET /health/live` | 进程存活检查（不检查依赖，始终 200） |
| `GET /health/ready` | 就绪检查：真实检查 PostgreSQL + Redis，未就绪返回 503 |
| `GET /version` | 服务名/版本/环境/Node 版本 |
| `POST /auth/login` / `GET /auth/me` | 本地邮箱登录与当前用户 |
| `/projects` | 项目注册、服务、环境、端点、成员、凭证 |
| `/project-manifests/validate` / `/project-manifests/apply` | manifest 校验与应用 |
| `/projects/:slug/observability-links` | 可观测性入口 |
| `/projects/:slug/governance-records` | 通用治理记录 |
| `/projects/:slug/governance-dashboard` | 治理中枢聚合总览 |
| `/projects/:slug/alerts/*`、`/deployments`、`/configurations`、`/secret-references`、`/cost-records`、`/model-routes`、`/prompt-versions`、`/evaluation-runs` | 告警、发布、配置/密钥、成本、模型、Prompt/评测专用治理入口 |
| `GET /docs` | OpenAPI（Swagger）文档 |

- 每个请求接收或生成 `x-request-id` 并写回响应头、写入结构化日志。
- 依赖故障时：live 仍 200、ready 返回 503 且标明故障组件、API 进程不崩溃、响应不泄露密码/连接串/堆栈。

## 9. CI

GitHub Actions workflow（`.github/workflows/ci.yml`）：固定 Node 24 + pnpm 11.7.0、frozen lockfile、format check / lint / typecheck / unit test / build（quality job）+ 集成测试（integration job，使用 PostgreSQL + Redis service containers）。本阶段 CI 不含 E2E。远程 CI 实际状态需在推送后于 GitHub Actions 页面确认。

## 10. 文档导航

| 文档 | 内容 |
|------|------|
| [愿景与产品边界](./docs/00-vision-and-scope.md) | 服务对象、解决与不解决的问题、责任边界 |
| [总体架构](./docs/01-architecture.md) | 架构图、模块边界、控制面与数据面 |
| [领域模型](./docs/02-domain-model.md) | 核心实体、关系、生命周期、实现阶段 |
| [项目接入协议](./docs/03-project-integration.md) | `project.yaml`、命名规则、接入方式 |
| [技术选型](./docs/04-technology-decisions.md) | NestJS/Prisma/Turborepo 等选型分析与锁定版本 |
| [开发路线](./docs/05-roadmap.md) | 12 个阶段的依赖与交付 |
| [安全原则](./docs/06-security-principles.md) | 权限、隔离、密钥、审计、故障隔离 |
| [风险分析](./docs/07-risks.md) | 主要风险与控制策略 |
| [分阶段技术方案](./docs/09-phased-technical-plan.md) | 从最小 MVP 到最终形态的阶段技术落地方案 |
| [ADR 索引](./docs/adr/README.md) | 架构决策记录 |

## 11. 贡献和开发约束

- 详见 [CLAUDE.md](./CLAUDE.md)；
- 默认按阶段交付和验收；连续推进时也要保留阶段边界、验证记录和真实状态文档；
- 不得以静态页面、假数据或伪实现冒充完成；
- 未真实执行验证不得声称通过；
- 文档只能描述当前真实状态，规划须明确标注；
- 不提交密钥、Token、密码和真实生产地址；
- 禁止 force push、`reset --hard`、改写历史等破坏性操作；
- 每阶段建议独立提交；完成后报告实际通过与受环境阻塞的验收项。

## 12. 安全说明

- 密钥真实值不进入仓库与数据库，只存元数据引用，真实值在外部 Secret Store / KMS；
- `project.yaml` 与所有文件禁止写入密钥、Token、密码、含密码连接字符串；
- 用户身份与服务身份分离，禁止跨项目共享凭证；
- 平台故障不能拖垮业务，SDK 具备超时、熔断、降级、异步上报、本地缓冲、丢弃策略；
- 详见 [安全原则](./docs/06-security-principles.md)。
