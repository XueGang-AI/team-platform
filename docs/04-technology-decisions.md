# 04 - 技术选型

> 本文记录平台关键技术选型的最终建议、理由、替代方案与已知风险。
> Phase 1 已通过 npm registry 与 Context7 验证并锁定精确版本（见 CLAUDE.md 技术栈表）。

## 0. Phase 1 已落地版本

Phase 1 工程骨架已完成，关键依赖锁定版本如下（来源：npm registry `npm view` + Context7 官方文档）：

| 维度 | 选型 | 锁定版本 |
|------|------|---------|
| Node.js | LTS | 24（.nvmrc） |
| 包管理 | pnpm workspace | 11.7.0 |
| Monorepo 编排 | Turborepo | 2.9.18 |
| TypeScript | — | 6.0.3 |
| 管理后台 | Next.js + React | 16.2.9 / 19.2.7 |
| 平台 API | NestJS（Express adapter） | 11.1.27 |
| API 文档 | @nestjs/swagger（OpenAPI） | 11.4.4 |
| 数据库 | PostgreSQL | postgres:16-alpine |
| ORM | Prisma（driver adapter） | 7.8.0 + @prisma/adapter-pg |
| 缓存 | Redis | redis:7-alpine / ioredis 5.11.1 |
| 结构化日志 | pino + nestjs-pino | 10.3.1 / 4.6.1 |
| 配置校验 | zod | 4.4.3 |
| 单元/集成测试 | Jest + ts-jest | 30.4.2 / 29.4.11 |
| E2E | Playwright | 1.61.0 |
| Lint/格式化 | ESLint + typescript-eslint + Prettier | 10.5.0 / 8.61.1 / 3.8.4 |

## 1. 选型总览

| 维度 | 选型 | 阶段 |
|------|------|------|
| Monorepo | pnpm workspace + Turborepo | Phase 1 |
| 管理后台 | Next.js + TypeScript | Phase 2 |
| 平台 API | NestJS（可切 Fastify adapter） | Phase 2 |
| 数据库 | PostgreSQL | Phase 1 |
| ORM | Prisma | Phase 1 |
| 缓存/队列 | Redis | Phase 1 |
| 可观测性 | OpenTelemetry + Prometheus + Grafana + Loki + Tempo | Phase 4 |
| 本地基础设施 | Docker Compose | Phase 1 |
| API 描述 | OpenAPI | Phase 2 |
| 测试 | 单元 + 集成 + Playwright E2E | 各阶段 |

## 2. NestJS vs Fastify

### 最终建议：NestJS（底层可切 Fastify adapter）

**选择理由**：
- 平台是长期演进的模块化单体，包含 14+ 业务模块，需要强结构约束与依赖注入来管理模块边界；
- NestJS 的 Module 装饰器天然映射模块化单体的模块边界，模块间通过 Provider 接口解耦，便于未来按需拆分；
- 内置 OpenAPI/Swagger、校验管道、守卫、拦截器，契合治理平台的鉴权、审计、校验需求；
- 控制面 QPS 不高，性能非第一瓶颈。

**替代方案**：Fastify（更轻量、性能更高，但需自行组织模块边界与 DI）。

**当前不选 Fastify 的原因**：在 14+ 模块的规模下，自行维护模块边界与 DI 的成本高于 NestJS 提供的结构收益。

**后续替换成本**：低。NestJS 支持切换底层 HTTP adapter 为 Fastify，若遇性能瓶颈可平滑切换，业务代码不变。

**已知风险**：NestJS 生态更新依赖其主版本周期；需在 Phase 1 锁定稳定主版本。

## 3. Prisma 是否适合

### 最终建议：Prisma

**选择理由**：
- TypeScript 优先，schema 即文档，迁移管理成熟，类型安全查询；
- 治理平台以 CRUD 与关联查询为主，Prisma 的查询能力足够；
- 与 PostgreSQL 契合。

**替代方案**：Drizzle（更轻、SQL 味重、性能好）、TypeORM（装饰器重、维护争议多）。

**当前不选替代的原因**：Prisma 的迁移与类型生成工具链成熟度更高，学习与维护成本更低。

**后续替换成本**：中。若遇复杂原生 SQL 或性能瓶颈，可在特定模块用 `$queryRaw` fallback，或评估迁移到 Drizzle。

**已知风险**：复杂查询与高级 PostgreSQL 特性需用 raw query；生成产物需加入 `.gitignore`。

> **Phase 1 实施说明（Prisma 7）**：Prisma 7 有重大变更——`datasource.url` 从 schema 移除，连接串改由 `prisma.config.ts` 提供，运行时必须通过 `@prisma/adapter-pg` driver adapter 注入 `PrismaClient`。
>
> **Phase 1.5 位置决策（见 [ADR-0004](./adr/0004-database-schema-location.md)）**：Prisma schema 与 `prisma.config.ts` 下沉到 `apps/api/prisma/`（单一消费者，模块化单体），生成产物输出到 `apps/api/src/generated/prisma`（CJS moduleFormat，不入库），由 API 直接消费。`db:generate`/`db:migrate` 脚本归属 `apps/api`。Phase 1 仅建立连接机制，不创建任何业务模型。

## 4. 是否需要 Turborepo

### 最终建议：pnpm workspace + Turborepo（保持轻量配置）

**选择理由**：
- monorepo 当前包含 `apps/`（api、web）、`packages/`（contracts、config、logger）、`infra/`、`tests/e2e`（远期随 Phase 推进可能新增 cli、sdk 等，见 [开发路线](./05-roadmap.md)）；
- Turborepo 提供任务编排、增量构建缓存、依赖图，随 app 增多收益递增。

**替代方案**：纯 pnpm workspace（不引入 Turborepo）。

**当前不纯用 pnpm workspace 的原因**：多 app 场景下增量构建缓存价值明显；Turborepo 配置轻量，引入成本低。

**已知风险**：配置不当可能带来缓存一致性误解；Phase 1 仅做最小配置。

## 5. 模块化单体如何划分

- 按**业务域**划分 NestJS Module（详见 [总体架构模块边界](./01-architecture.md#3-模块边界)）；
- 模块间通过**接口依赖注入**而非直接 import 实现；
- 跨模块通信走明确的接口契约，禁止跨模块直接操作对方数据库表；
- 未来可拆分性：每个模块的接口契约先行，实现可独立替换为远程服务。

## 6. 可观测性如何集成而非重做

- **采集**：接入方通过 OpenTelemetry SDK 采集日志/指标/trace，注入统一维度标签；
- **存储**：Loki（日志）、Prometheus（指标）、Tempo（trace），均为成熟开源组件；
- **可视化**：Grafana 统一 Dashboard，平台提供带项目上下文的跳转与嵌入；
- **平台职责**：接收采集数据并关联 `project_id` 等维度，存索引与跳转链接到 PostgreSQL，**不复制全量数据**。

详见 [ADR-0003](./adr/0003-observability-integration.md)。

## 7. 密钥中心：自建元数据层 + 接入外部 Secret Store

### 最终建议：平台只存 SecretMetadata，真实密钥存外部

**选择理由**：
- 自建加密存储的安全与运维成本极高，且难以达到专业 Secret Store 的安全等级；
- 平台只需维护密钥的**引用、版本、轮换策略、审计**，真实值交给 Vault / 云 KMS / 外部 Secret Store。

**替代方案**：自建加密密钥库。

**当前不自建的原因**：安全责任与运维成本不匹配；专业外部组件更可靠。

**后续替换成本**：低。`external_ref` 抽象屏蔽了具体 Store 实现，可切换 provider。

## 8. 第一阶段是否需要 Kubernetes

### 最终建议：不需要，使用 Docker Compose

**选择理由**：
- 团队内部规模，Docker Compose 足以覆盖本地与单机部署；
- K8s 带来的运维复杂度远超当前收益；
- 平台控制面与数据面组件均可通过 Compose 编排。

**未来触发条件**：多环境多集群、自动伸缩、滚动发布等需求真实出现时再评估，并伴随 ADR。

## 9. 版本锁定策略

- Phase 0 不锁定精确版本；
- Phase 1 工程骨架落地时，通过官方文档（优先 Context7）验证当前稳定主版本后锁定；
- 依赖升级走独立变更与 ADR，不混入业务提交。

## 10. 相关文档

- [总体架构](./01-architecture.md)
- [ADR 索引](./adr/README.md)
- [开发路线](./05-roadmap.md)
