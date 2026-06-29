# 08 - 仓库架构

> 本文记录 team-platform 仓库的目录结构、各目录职责、文件放置规则与依赖方向。
> Phase 1.5 完成系统级目录架构收敛后建立，作为后续 Phase 新增代码的放置依据。
> 与 [CLAUDE.md](../CLAUDE.md) 的「文件放置规则」章节保持一致。

## 1. 最终目录树

```
team-platform/
├── apps/
│   ├── api/                    # 平台 API（NestJS），含 Prisma schema 与生成产物
│   │   ├── prisma/             # Prisma schema 与迁移（单一消费者，下沉到此）
│   │   ├── prisma.config.ts    # Prisma 7 连接配置
│   │   ├── src/                # 应用源码
│   │   │   ├── generated/      # Prisma 生成产物（gitignored，不入库）
│   │   │   ├── common/         # 跨模块共享的基础设施（request-id / 错误 / 过滤器）
│   │   │   ├── health/         # 健康检查模块
│   │   │   ├── version/        # 版本模块
│   │   │   ├── prisma/         # Prisma 服务封装
│   │   │   ├── redis/          # Redis 服务封装
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/               # 单元测试（test/unit）+ 集成测试（test/integration）
│   │   ├── nest-cli.json
│   │   ├── jest.config.ts
│   │   ├── jest.integration.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── cli/                    # team-platform CLI
│   └── web/                    # 管理后台（Next.js）
│       ├── src/
│       │   ├── app/            # App Router 页面
│       │   ├── components/     # React 组件
│       │   └── lib/            # API 客户端、env 等工具
│       ├── jest.config.ts
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── contracts/              # 跨应用共享类型与常量契约
│   ├── config/                 # 运行时环境变量校验（zod，API + Web 消费）
│   ├── logger/                 # 结构化日志共享脱敏配置（API 消费）
│   ├── sdk-python/             # Python SDK
│   └── sdk-ts/                 # TypeScript SDK
├── examples/
│   └── project-manifests/      # project.yaml 接入示例
├── infra/
│   ├── README.md               # 本地基础设施说明（编排在根 compose.yaml）
│   └── observability/          # OTel/Prometheus/Loki/Tempo/Grafana 配置
├── tests/
│   └── e2e/                    # 跨应用 Playwright E2E 测试
├── docs/                       # 架构文档与 ADR
├── .github/workflows/          # GitHub Actions CI
├── compose.yaml                # 本地基础设施（默认可观测性组件；local-db profile 可选 PG/Redis）
├── package.json                # 根 manifest 与 workspace 脚本
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.mjs
├── .prettierrc / .prettierignore
├── .editorconfig
├── .nvmrc
├── .env.example
├── .gitignore
├── README.md
└── CLAUDE.md
```

## 2. 各目录职责

| 目录 | 职责 | 禁止放置 |
|------|------|---------|
| `apps/api` | 平台 API 应用，含其专属的 Prisma schema、迁移、生成产物、测试 | 不放 Web 代码；不放跨应用共享的纯类型（放 contracts） |
| `apps/web` | 管理后台应用 | 不直连 PostgreSQL/Redis；不放 Node 专用代码；不放服务端密钥 |
| `apps/cli` | 平台 CLI | 不放平台服务端实现；不绕过 SDK/API 直接连库 |
| `packages/contracts` | API、Web、CLI、SDK 共享的类型与常量契约 | 不含运行时框架依赖；不含业务实现；不含仅某一端用的内部类型 |
| `packages/config` | API 与 Web 双端真实共享的环境变量校验 schema 与 loader | 不把 Node 专用能力打包进 Web 客户端 |
| `packages/logger` | 共享的日志脱敏配置 | 不绑定 NestJS；不含未被消费的工厂代码 |
| `packages/sdk-ts` | TypeScript SDK | 不承担业务逻辑；只封装平台协议 |
| `packages/sdk-python` | Python SDK | 不承担业务逻辑；优先保持低依赖 |
| `examples/` | 接入 manifest 示例 | 不放真实密钥、生产内网地址或业务数据 |
| `infra/` | 本地基础设施说明与可观测性组件配置 | 不放真实生产凭据 |
| `tests/e2e/` | 跨应用 E2E 测试 | 不放应用内单元/集成测试 |
| `docs/` | 架构文档与 ADR | 不放代码 |
| `.github/workflows/` | CI workflow | 不放部署/发布脚本 |

## 3. 根目录文件保留原则

根目录保留仓库级工具默认识别路径与项目入口文档，**不为视觉整洁移动标准根配置**：

- `package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `turbo.json`：pnpm workspace 与 Turborepo 入口
- `tsconfig.base.json`：所有子包/app 的共享 TS 配置基线
- `eslint.config.mjs` / `.prettierrc` / `.prettierignore` / `.editorconfig`：代码风格工具入口
- `.nvmrc`：Node 版本
- `.env.example`：环境变量模板（开发者期望在根 `cp`）
- `compose.yaml`：Docker Compose 默认入口
- `.gitignore`：Git 必须在根
- `README.md` / `CLAUDE.md`：仓库入口文档

移动根配置的条件：工具仍能稳定识别 + 根入口仍清晰 + 减少真实重复或职责混乱 + 所有脚本/文档同步 + 完整验证通过。否则保持不动。

## 4. Package 边界与依赖方向

依赖方向严格单向：

```
apps/web ──→ packages/contracts
        └──→ packages/config

apps/api ──→ packages/contracts
        ├──→ packages/config
        └──→ packages/logger

apps/cli ──→ packages/sdk-ts
        └──→ packages/contracts

packages/sdk-ts ──→ packages/contracts

packages/* 不得依赖 apps/*
除 sdk-ts 依赖 contracts 外，packages 之间不做横向依赖
```

规则：
- `packages/*` 禁止 import `apps/*`（无反向依赖）。
- `packages/*` 之间默认禁止横向 import；当前仅允许 `sdk-ts -> contracts`。
- `contracts` 不依赖任何框架。
- `config` 仅依赖 `zod`。
- `logger` 不绑定 NestJS。
- `apps/web` 不依赖 Node 专用代码，不直连数据库/Redis。

## 5. 文件放置规则

- **新增 app**：满足「`apps/` + `pnpm-workspace.yaml` 声明 + 真实可运行」才创建，不创建空 app。
- **新增 package**：必须同时满足「至少两个真实消费者 + 职责单一 + 不依赖 apps」才提取为独立 package。单一消费者的代码留在消费方 app 内，不为未来想象提前抽象。
- **跨边界契约**：API 与 Web 都用的类型/常量放 `packages/contracts`；仅某一端用的类型留在该端。
- **Prisma 文件**：schema、迁移、`prisma.config.ts` 放 `apps/api/prisma/`（单一消费者）。生成产物 `src/generated/`（gitignored）。
- **测试文件**：应用单元测试靠近应用（`apps/api/test/unit`、`apps/web/src/**/*.test.ts`）；API 集成测试 `apps/api/test/integration`；跨应用 E2E 放 `tests/e2e`。
- **生成物**：所有生成产物（Prisma client、`.next`、`dist`、`*.tsbuildinfo`、Playwright 产物）一律 gitignored，不入库。
- **基础设施**：本地编排在根 `compose.yaml`；说明文档在 `infra/`；不为无配置组件创建空子目录。
- **业务模块**：Phase 2 起按业务域在 `apps/api/src/<domain>/` 新增 NestJS Module，不提前创建空模块目录。

## 6. 禁止放置的位置

- `packages/*` 中放入仅某一端使用的内部类型或实现。
- `apps/web` 中直连 PostgreSQL/Redis 或存放服务端密钥。
- 根目录创建 `scripts/` 等空目录（除非有真实脚本，且数量达到需分类的程度）。
- 为「未来可能需要」创建空 package / 空模块 / `.gitkeep` 占位。
- 生成产物入库。
- Prisma schema 放到独立 package 却无第二消费者（见 [ADR-0004](./adr/0004-database-schema-location.md)）。

## 7. 未来新增 app/package 的准入条件

| 类型 | 准入条件 |
|------|---------|
| 新 app | 有真实可运行的独立应用需求；纳入 `pnpm-workspace.yaml`；定义自己的 `package.json`/`tsconfig.json`；不破坏依赖方向 |
| 新 package | 至少两个真实消费者；职责单一可独立测试；不依赖 apps；不重复已有 package 能力 |
| 新业务模块（apps/api/src 内） | 按业务域划分；通过接口依赖注入与其他模块通信；禁止跨模块直接操作对方数据库表 |

## 8. 测试位置规则

| 测试类型 | 位置 | 运行命令 |
|---------|------|---------|
| API 单元测试 | `apps/api/test/unit/*.spec.ts` | `pnpm test`（turbo run test，排除 e2e） |
| API 集成测试 | `apps/api/test/integration/*.integration.ts` | `pnpm test:integration` |
| Web 单元测试 | `apps/web/src/**/*.test.ts(x)` | `pnpm test` |
| 跨应用 E2E | `tests/e2e/tests/*.spec.ts` | `pnpm test:e2e` |

CI 与本地运行相同测试入口。E2E 不在 CI 中运行（需真实浏览器 + 启动服务）。

## 9. 生成物规则

- Prisma 生成产物：`apps/api/src/generated/prisma/`（gitignored + prettierignore + eslint ignore）。
- Next.js 构建：`apps/web/.next/`（gitignored）。
- TS 编译产物：`apps/*/dist/`、`packages/*/dist/`（gitignored）。
- `*.tsbuildinfo`（gitignored）。
- Playwright 产物：`tests/e2e/test-results/`、`tests/e2e/playwright-report/`（gitignored）。

## 10. 基础设施文件规则

- 本地编排在根 `compose.yaml`（Docker Compose 默认入口）。
- 说明文档在 `infra/README.md`。
- 当前默认本地组件：OpenTelemetry Collector、Prometheus、Loki、Tempo、Grafana。
- PostgreSQL 与 Redis 默认使用机器级通用服务 `127.0.0.1:15432` / `127.0.0.1:16379`；仅在隔离调试时使用 `local-db` profile 启动项目专属 PG/Redis。
- 端口：本地宿主 15432(PG)/16379(Redis)/3220(Grafana)/3221(Prometheus)/3222(Loki)/3223(Tempo HTTP)/3224-3226(OTel Collector)/3227(Tempo OTLP) 避开常见冲突；CI service container 用默认 5432/6379。
- 不为无额外配置的组件创建 `infra/postgres/`、`infra/redis/` 空目录。

## 11. 相关文档

- [CLAUDE.md 文件放置规则](../CLAUDE.md)
- [ADR-0004 Prisma schema 位置](./adr/0004-database-schema-location.md)
- [技术选型](./04-technology-decisions.md)
- [开发路线](./05-roadmap.md)
