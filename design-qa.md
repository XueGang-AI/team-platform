# 设计 QA

## 验收范围

- 实现入口：`http://127.0.0.1:3200`
- API/健康面：`http://127.0.0.1:3201`
- 桌面视口：`1487x1058`、`1992x1100`
- 移动视口：`390x900`
- 当前验证截图目录：`/tmp/team-platform-workspace-cleanup-20260629/`
- 当前最终验证摘要：`/tmp/team-platform-workspace-cleanup-20260629/final-validation-summary.json`
- `#health` 基础设施卡片返工证据目录：`/tmp/team-platform-health-panel-fix-20260629/`
- 全项目真实性返工复验证据目录：`/tmp/team-platform-authenticity-recheck-20260629/`
- 仓库清理与文档更新证据目录：`/tmp/team-platform-repo-cleanup-20260629/`
- 当前内部工作区：`#overview`、`#catalog`、`#services`、`#health`、`#governance`、`#release`、`#cost`、`#access`、`#integration`、`#observability`
- 外部 API 文档入口：`/api/platform/docs`

## 本轮调整

- 工作区空白整理：收紧 `#services`、`#health`、`#governance`、`#release`、`#cost`、`#access` 的栅格比例、固定高度、面板间距和空态高度，避免无内容的大块浅灰/白色区域。
- 控件挤压修复：顶部工具栏改为更稳的三列/两列响应布局，“快速入口”保持单行按钮形态，不再被压成竖排字。
- 服务与环境：资源树、服务表格、端点详情、凭证/治理操作改为更紧凑的三栏结构，表格最小宽度和右侧详情底部对齐更稳定。
- 告警、发布、成本、权限：右侧建议、质量图、成本归因、凭证库存等区域降低无效 `min-height`，无数据时使用紧凑空态。
- API 文档入口：删除内部 `#api-docs` 工作区，侧栏“平台 API 文档”直接打开真实 Swagger 页面 `/api/platform/docs`。
- 回归保护：保留桌面固定侧栏修复，保留 `390px` 移动端目录页顶部导航/全宽主内容修复。

## QA 返工修复：健康页基础设施卡片

- 问题：`1487x1058 #health` 右侧 `.system-health-panel` 中 `StatusDashboard` 卡片继承全局四列状态列表，窄栏内 `.status-list clientWidth=290`、`scrollWidth=347`，Redis 等卡片内容发生横向裁切。
- 修复：为 `.system-health-panel` 增加局部紧凑布局，状态列表改为单列，卡片内主标题与状态徽标使用 `minmax(0, 1fr) max-content`，hint/error 文本允许在面板内换行。
- 返工后量测：`.status-list clientWidth=290`、`scrollWidth=290`；四个 `.status-row right=1444`，均小于 `.system-health-panel right=1469`；页面 `scrollWidth=1487`。
- 截图：`/tmp/team-platform-health-panel-fix-20260629/health-1487-fixed.png`
- DOM 摘要：`/tmp/team-platform-health-panel-fix-20260629/system-health-panel-fixed-summary.json`

## 真实性返工复验：假数据、假控件和环境重复

- 构建阻断：已清理 `GovernanceWorkspace` 未使用参数，`pnpm platform:start` 可重新构建并启动 Web/API。
- 项目目录：目录表格只展示 `/api/platform/projects` 返回的真实项目；测试断言限定在 `.project-table .project-row`，避免用全页重复文本证明真实性。
- 假数据死代码：已删除生产 UI 中不再使用的演示治理记录入口，治理、发布、成本、观测为空时显示紧凑真实空态，不再展示样例项目、样例告警、样例发布、样例预算或固定观测平台记录。
- 观测页：无真实链接时不再显示 `Grafana` 或 `grafana.example.com` 等供应商示例文案/URL，改为通用“观测平台链接名称”和 `https://example.com/observability/...` 占位。
- 顶部工具栏：全局搜索、当前项目、当前环境保持 disabled，并用 `aria-label/title` 说明暂未接入或由工作台真实数据控制。
- 环境一致性：默认 manifest 与 E2E manifest 统一使用 canonical `slug: docker`；manifest 应用后会归档同项目内 manifest 未声明的旧服务/环境，项目详情只返回未归档资源，避免历史 `docker-demo` 与 `docker` 同名环境同时出现在 UI。
- API 对照：登录后 `/api/platform/projects` 返回 `total=1`、唯一项目 `manjv-studio`；`/api/platform/projects/manjv-studio` 返回环境 `docker`、`local`，未返回 `docker-demo`；`/governance-dashboard` 中 `alerts/deployments/costRecords/configurations/tasks/modelRoutes` 均为 `0`。
- 真实浏览器复验：`#catalog`、`#governance`、`#release`、`#cost`、`#access`、`#observability` 均无样例/供应商假文案，控制台无 error/warn；侧栏“平台 API 文档”进入真实 Swagger UI，不渲染平台侧栏。

### 真实性证据

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 桌面真实性复验 | `1487x1058` 下 6 个重点页无假文案、无横向溢出、控制台无 error/warn | `/tmp/team-platform-authenticity-recheck-20260629/browser-authenticity-summary.json` |
| 目录页移动端 | `390x900` 下 `scrollWidth=390`、`.app-main width=390`、无样例项目 | `/tmp/team-platform-authenticity-recheck-20260629/catalog-390x900.png` |
| 固定侧栏回归 | `1992x1100 #cost` 滚动到底部后 `.app-sidebar height=1100 bottom=1100` | `/tmp/team-platform-authenticity-recheck-20260629/cost-1992x1100-scrolled.png` |
| Swagger 外链 | `/api/platform/docs` 标题为 `Swagger UI`，可见 Swagger UI 容器，无 `.app-sidebar` | `/tmp/team-platform-authenticity-recheck-20260629/swagger-docs-1487x1058.png` |

## 仓库清理与文档更新

- 冗余删除：删除 `apps/web/src/app/globals.css` 中仅服务于已移除内部 `#api-docs` 工作区的 `.docs-*`、`.code-panel`、`.response-preview`、`.param-table`、`.request-*`、`.schema-*`、`.workflow-steps` 等死样式。删除依据：生产组件不再渲染内部 API 文档页，`rg` 仅命中 CSS 定义，清理后同类选择器无残留命中。
- 文档更新：同步更新 `README.md`、`CLAUDE.md`、`docs/03-project-integration.md`、`docs/08-repository-architecture.md`、`docs/09-phased-technical-plan.md`、`infra/README.md`，覆盖当前 Web/API `3200/3201`、Swagger `/api/platform/docs`、通用 PostgreSQL/Redis `15432/16379`、真实数据/空态策略、canonical 环境 `local/docker`、manifest apply 归档语义和 Compose 默认行为。
- 依赖审查：执行 `pnpm dlx depcheck --json` 与各 workspace depcheck。根、CLI、SDK、E2E 无未使用依赖；API/Web depcheck 报告项经 `pnpm why`、配置文件和动态引用核对后均保留，未删除依赖。
- 保留依据：`pg` 由 `@prisma/adapter-pg` 使用；`pino-pretty` 是开发环境 pino transport；`@prisma/config` 被 `apps/api/prisma.config.ts` 使用；`@nestjs/schematics` 被 `nest-cli.json` 使用；`ts-node`、`tsconfig-paths`、`source-map-support` 属于 Nest/Jest/ts-jest 支撑链；Web `@types/node` 支撑 Next 配置与测试类型链。
- 未执行破坏性清理：`git clean -ndX` 只做 dry-run，发现 `.env`、`node_modules/`、`.turbo/`、`dist/`、`tmp/`、Playwright 产物等被忽略文件，按要求未批量删除，避免误删本地环境和验证证据。
- `agent_memory/` 风险：仓库根目录缺少 `agent_memory/`，且 `/Users/xuegang/.codex/templates/agent_memory/` 当前不可用；按规划交接要求未伪造模板结构，作为流程风险记录。
- Git 状态：未暂存、未提交、未推送；当前拟交 QA 审查的 tracked 改动为 `git status --short` 中列出的 36 个已修改文件，另有新增 `agents/` 与 `design-qa.md`。QA 通过前不执行 commit/push。

### 仓库清理验证

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 10 个内部工作区浏览器回归 | `1487x1058` 下全部可访问，`scrollWidth=innerWidth=1487`，控制台无 error/warn | `/tmp/team-platform-repo-cleanup-20260629/browser-regression-summary.json` |
| 桌面滚动侧栏 | `1992x1100` 下 10 个内部工作区滚动到底部，左下探针均命中 `.app-sidebar`，`sidebarBottom=1100` | `/tmp/team-platform-repo-cleanup-20260629/browser-regression-summary.json` |
| 项目目录移动端 | `390x900` 下 `scrollWidth=390`、`.app-main width=390`、首行项目 `right=364` | `/tmp/team-platform-repo-cleanup-20260629/catalog-mobile-390x900.png` |
| Swagger 外链 | `/api/platform/docs` 标题为 `Swagger UI`，可见 Swagger UI 容器，无 `.app-sidebar` | `/tmp/team-platform-repo-cleanup-20260629/swagger-docs-1487x1058.png` |
| 死样式残留扫描 | 清理后旧内部文档工作区选择器无命中 | `rg ".docs-|.code-panel|.response-preview|.param-table|.request-|.schema-|.workflow-steps" apps/web/src/app/globals.css` |

## 当前截图证据

| 页面 | 视口 | 截图 |
| --- | --- | --- |
| 服务与环境 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/services-1487.png` |
| 健康状态 | `1487x1058` | `/tmp/team-platform-health-panel-fix-20260629/health-1487-fixed.png` |
| 告警治理 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/governance-1487.png` |
| 发布记录 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/release-1487.png` |
| 成本 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/cost-1487.png` |
| 权限凭证 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/access-1487.png` |
| 项目目录移动端 | `390x900` | `/tmp/team-platform-workspace-cleanup-20260629/catalog-390.png` |
| Swagger 文档 | `1487x1058` | `/tmp/team-platform-workspace-cleanup-20260629/swagger-docs.png` |

## 量测结果

- `1487x1058` 下 10 个内部工作区均可访问，`scrollWidth <= innerWidth + 1`。
- `1992x1100` 下相关工作区无页面级横向溢出，固定侧栏底部持续覆盖视口底部。
- `#services`：`.service-workbench height=640.79`，右侧 inspector 与工作台底部差值约 `1px`。
- `#health`：快速入口按钮 `width=57.125`、`height=34`，保持横向可读；右侧基础设施状态列表 `scrollWidth=290`、`clientWidth=290`，所有状态卡片均在面板右边界内。
- `#release`：发布列表/详情到发布质量区间距 `12px`。
- `#cost`：成本卡片区到归因明细间距 `12px`。
- `#access`：凭证库存高度 `164.83px`，风险建议高度 `197.41px`。
- `390x900 #catalog`：`scrollWidth=390`，`.app-main width=390`，目录面板 `right=378`，项目行 `right=364`，搜索框 `right=365`。
- API 文档：侧栏链接打开 `http://127.0.0.1:3200/api/platform/docs`，页面标题为 `Swagger UI`，可见 Swagger UI 根容器；不再停留在 `/#api-docs`。
- 浏览器控制台：无应用相关 error/warn。

## 命令验证

- `pnpm typecheck`：passed，12 个 typecheck/build 任务通过。
- `pnpm test`：passed，Web 36 项、API 18 项通过。
- `pnpm test:e2e`：passed，11 个 Playwright 测试通过。
- `pnpm platform:start`：passed，最终源码重新构建并启动 Web `http://localhost:3200`、API `http://localhost:3201`。
- 仓库清理后复验：`pnpm typecheck` passed；`pnpm test` passed；`pnpm test:e2e` passed；`pnpm platform:start` passed。
- `curl http://127.0.0.1:3201/health/live`：passed，`status=ok`。
- `curl http://127.0.0.1:3201/health/ready`：passed，PostgreSQL/Redis 均为 `ok`。

## E2E 覆盖

- 10 个内部 hash 工作区回归，不再包含 `#api-docs`。
- 新增/更新“平台 API 文档入口跳转真实 Swagger 页面”断言。
- 新增/更新“重点工作区桌面布局紧凑且无控件挤压”断言，覆盖 `#services`、`#health`、`#governance`、`#release`、`#cost`、`#access`；其中 `#health` 明确检查 `.system-health-panel .status-list scrollWidth <= clientWidth + 1` 且所有 `.status-row right <= panel.right + 1`。
- 保留“桌面滚动到底部后左侧导航持续覆盖视口”断言。
- 保留“390px 移动端项目目录主内容可读且关键容器不越界”断言。
- 新增“项目目录只展示真实 API 项目且无样例项目”断言，读取真实 `/api/platform/projects` 后对目录行数、项目 slug/name、分页总数做容器内校验。
- 新增“治理发布成本观测为空时不显示硬编码演示数据”断言，读取真实 `/governance-dashboard` 后确认空记录状态下不出现硬编码告警、发布、预算、成本建议或观测供应商示例。
- 新增“未接入控件禁用，真实控件有反馈”断言，覆盖成本/发布未接入控件 disabled、服务搜索真实过滤、权限凭证表单入口、顶部工具栏 disabled 状态。

## 残余风险

- 本轮对 manifest 应用行为做了收口：未在 manifest 中声明的同项目服务/环境会被归档；项目详情默认只展示未归档资源。若后续需要“历史资源回收站”视图，应通过明确的 includeArchived 参数或专门页面设计，不应混入当前真实工作台。
- 浏览器采集基于当前本机真实服务和 Manjv Studio 数据；若本机项目成员权限或种子数据被清空，部分登录后工作区会显示空态，但布局空态已收紧。

## final result

passed
