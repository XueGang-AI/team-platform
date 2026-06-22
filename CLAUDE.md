# CLAUDE.md — team-platform 项目开发约束

> 本文件指导后续 Claude Code 在本项目中的开发行为。所有规则优先于通用偏好，必须严格遵守。

## 1. 先读这些文档

进入本项目后，动手前必须先读：

1. [README.md](./README.md) — 项目入口与当前状态；
2. [docs/00-vision-and-scope.md](./docs/00-vision-and-scope.md) — 产品边界与责任划分；
3. [docs/01-architecture.md](./docs/01-architecture.md) — 总体架构与模块边界；
4. [docs/05-roadmap.md](./docs/05-roadmap.md) — 当前与后续阶段；
5. 本文件 — 开发约束。

涉及具体模块时再读对应文档（领域模型、接入协议、技术选型、安全原则、风险、ADR）。

## 2. 当前项目目标

构建团队统一项目治理平台。**当前阶段为 Phase 1.5（系统级目录架构审计与收敛），已完成。** 下一阶段为 Phase 2（项目注册与服务目录），由用户明确指令启动，不得自行进入。

## 3. 当前架构

- 模块化单体（NestJS Module 划分业务域）；
- 控制面（PostgreSQL）与数据面（Loki/Prometheus/Tempo/Grafana/对象存储/外部 Secret Store）分离；
- 优先集成成熟开源组件，不自造存储与可视化；
- 管理后台 Next.js，API NestJS，monorepo 用 pnpm workspace + Turborepo。

详见 [docs/01-architecture.md](./docs/01-architecture.md)。

## 4. 模块边界

按业务域划分模块（ProjectRegistry / Auth / ServiceCredential / Observability / Config / Alert / Release / Task / File / Notification / FeatureFlag / ModelGateway / Cost / Audit）。模块间通过接口依赖注入通信，禁止跨模块直接操作对方数据库表。详见 [docs/01-architecture.md](./docs/01-architecture.md#3-模块边界)。

## 5. 技术栈

| 维度 | 选型 | 锁定版本（Phase 1） |
|------|------|------|
| Monorepo | pnpm workspace + Turborepo | pnpm 11.7.0 / Turbo 2.9.18 |
| 管理后台 | Next.js + TypeScript | Next 16.2.9 / React 19.2.7 / TS 6.0.3 |
| API | NestJS（Express adapter） | NestJS 11.1.27 |
| 数据库 | PostgreSQL | postgres:16-alpine |
| ORM | Prisma（driver adapter） | Prisma 7.8.0 + @prisma/adapter-pg |
| 缓存/队列 | Redis | redis:7-alpine / ioredis 5.11.1 |
| 结构化日志 | pino + nestjs-pino | pino 10.3.1 / nestjs-pino 4.6.1 |
| 配置校验 | zod | 4.4.3 |
| 可观测性 | OpenTelemetry + Prometheus + Grafana + Loki + Tempo | Phase 4 引入 |
| 本地基础设施 | Docker Compose | 仅 PG + Redis |
| API 描述 | OpenAPI（Swagger） | @nestjs/swagger 11.4.4 |
| 测试 | Jest + Playwright E2E | Jest 30.4.2 / Playwright 1.61.0 |

精确版本已通过 npm registry 与 Context7 在 Phase 1 验证锁定。详见 [docs/04-technology-decisions.md](./docs/04-technology-decisions.md)。

## 6. 命名规范

- 项目 slug / 服务 slug：`^[a-z][a-z0-9-]{1,62}$`，小写 kebab-case；
- 环境名：`dev` / `staging` / `prod` 或小写自定义；
- 代码标识符遵循各语言社区规范，与周围代码风格一致。

## 7. 安全规则

- 不提交密钥、Token、密码、真实生产地址；
- 密钥真实值不入库不入仓库，只存 `SecretMetadata` 引用；
- `project.yaml` 禁止写入敏感信息（见 [docs/03-project-integration.md](./docs/03-project-integration.md#5-敏感信息禁止写入清单)）；
- 用户身份与服务身份分离，禁止跨项目共享凭证；
- 平台故障不拖垮业务，SDK 需超时/熔断/降级/异步/缓冲/丢弃；
- 详见 [docs/06-security-principles.md](./docs/06-security-principles.md)。

## 8. Git 规则

- 默认分支 `main`，remote 为 `git@github.com:XueGang-AI/team-platform.git`；
- 未经明确要求不执行 `git commit` / `git push`；
- 禁止 `force push`、`reset --hard`、`git clean`、改写历史等破坏性操作；
- 修改前先 `git status`，不覆盖未提交修改；
- 只修改任务直接需要的文件，完成后 `git diff` 检查是否误改无关文件；
- 每阶段独立提交。

## 9. 测试要求

- 修改后执行与改动范围匹配的检查（lint / typecheck / test / build）；
- 只汇报实际执行过的命令和结果，无法验证时明确说明原因；
- 不伪造 API、配置、测试或执行结果。

## 10. 文档同步要求

- 文档只能描述当前真实状态；
- 规划中的能力必须明确标注为「规划」或「未来」，不得写成已完成；
- 架构图、领域模型、路线图、技术选型、README 之间保持一致，无矛盾；
- 新增长期架构决策以 ADR 记录。

## 11. Skill 使用要求

- 不重复安装已有 Skill，不修改用户级 Skill/MCP/Hook；
- 新建管理后台优先使用 `frontend-design`；
- 视觉审美、去模板化、界面质量检查使用 `design-taste-frontend`；
- 已有页面视觉重构才使用 `redesign-existing-projects`；
- React/Next.js 工程实现使用 `vercel-react-best-practices`；
- 组件 API 与组合模式使用 `vercel-composition-patterns`；
- 页面规范检查使用 `web-design-guidelines`；
- 后台与高密度页面只有限参考 Taste Skill，不为审美牺牲信息密度与操作效率。

## 12. MCP 使用要求

- 浏览器真实交互与页面验证优先使用 **Playwright** MCP；
- 文档与依赖查询优先使用 **Context7** MCP（不凭过期记忆编造版本）；
- 复杂架构问题优先使用 **Sequential Thinking** MCP 拆解；
- GitHub 写操作必须获得明确授权，默认只读；GitHub MCP 未连接时用本地 Git + SSH；
- 工具不可用时说明原因，使用可验证的替代方案。

## 13. 文件放置规则

> 详见 [docs/08-repository-architecture.md](./docs/08-repository-architecture.md)。本节为开发时必须遵守的要点。

- **根配置文件保留原则**：`package.json`/`pnpm-workspace.yaml`/`pnpm-lock.yaml`/`turbo.json`/`tsconfig.base.json`/`eslint.config.mjs`/`.prettierrc`/`.prettierignore`/`.editorconfig`/`.nvmrc`/`.env.example`/`compose.yaml`/`.gitignore`/`README.md`/`CLAUDE.md` 必须留在根目录（工具默认识别路径）。不为视觉整洁移动标准根配置。
- **新增 app 条件**：满足「`apps/` + `pnpm-workspace.yaml` 声明 + 真实可运行」才创建，不创建空 app。
- **新增 package 条件**：必须同时满足「至少两个真实消费者 + 职责单一 + 不依赖 apps」才提取为独立 package。单一消费者的代码留在消费方 app 内。
- **packages 禁止依赖 apps**：`packages/*` 不得 import `apps/*`；`packages/*` 之间禁止横向依赖。
- **共享包必须有真实消费者**：禁止创建无消费者、无 exports 的空 package 或 schema-only 占位包。
- **禁止创建空目录和占位 package**：不使用 `.gitkeep` 维持空目录；不为「未来可能需要」提前创建空模块。
- **Prisma 文件位置**：schema、迁移、`prisma.config.ts` 放 `apps/api/prisma/`（单一消费者，见 [ADR-0004](./docs/adr/0004-database-schema-location.md)）；生成产物 `apps/api/src/generated/`（gitignored）。
- **测试文件位置**：应用单元测试靠近应用（`apps/api/test/unit`、`apps/web/src/**/*.test.ts`）；API 集成测试 `apps/api/test/integration`；跨应用 E2E 放 `tests/e2e`。
- **生成物位置和忽略规则**：所有生成产物（Prisma client、`.next`、`dist`、`*.tsbuildinfo`、Playwright 产物）一律 gitignored，不入库。
- **业务模块**：Phase 2 起按业务域在 `apps/api/src/<domain>/` 新增 NestJS Module，不提前创建空模块目录。

## 14. 阶段纪律

- 每次只执行一个 Phase，不得跨阶段开发；
- 不得以静态页面、假数据或伪实现冒充完成；
- 未真实执行验证不得声称通过；
- 每阶段完成后必须停止并报告，等待下一条明确指令；
- Phase 1.5 已完成，下一阶段为 Phase 2，由用户明确指令启动。
