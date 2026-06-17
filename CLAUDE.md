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

构建团队统一项目治理平台。**当前阶段为 Phase 0（架构与仓库初始化），已完成。** 下一阶段由用户明确指令启动，不得自行进入 Phase 1。

## 3. 当前架构

- 模块化单体（NestJS Module 划分业务域）；
- 控制面（PostgreSQL）与数据面（Loki/Prometheus/Tempo/Grafana/对象存储/外部 Secret Store）分离；
- 优先集成成熟开源组件，不自造存储与可视化；
- 管理后台 Next.js，API NestJS，monorepo 用 pnpm workspace + Turborepo。

详见 [docs/01-architecture.md](./docs/01-architecture.md)。

## 4. 模块边界

按业务域划分模块（ProjectRegistry / Auth / ServiceCredential / Observability / Config / Alert / Release / Task / File / Notification / FeatureFlag / ModelGateway / Cost / Audit）。模块间通过接口依赖注入通信，禁止跨模块直接操作对方数据库表。详见 [docs/01-architecture.md](./docs/01-architecture.md#3-模块边界)。

## 5. 技术栈

| 维度 | 选型 |
|------|------|
| Monorepo | pnpm workspace + Turborepo |
| 管理后台 | Next.js + TypeScript |
| API | NestJS |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 缓存/队列 | Redis |
| 可观测性 | OpenTelemetry + Prometheus + Grafana + Loki + Tempo |
| 本地基础设施 | Docker Compose |
| API 描述 | OpenAPI |
| 测试 | 单元 + 集成 + Playwright E2E |

精确版本在 Phase 1 通过官方文档验证后锁定，不凭记忆编造版本号。详见 [docs/04-technology-decisions.md](./docs/04-technology-decisions.md)。

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

## 13. 阶段纪律

- 每次只执行一个 Phase，不得跨阶段开发；
- 不得以静态页面、假数据或伪实现冒充完成；
- 未真实执行验证不得声称通过；
- 每阶段完成后必须停止并报告，等待下一条明确指令。
