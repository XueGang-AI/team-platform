# 验收日志

## 2026-06-28 18:26 +0800 - 11 页目标草图 1:1 复刻验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认 QA 只接受 developer 验收交接，失败后退回 developer。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；桌面视口 `1487x1058`；移动视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`。
- 浏览器验证：11 个 hash 均可访问，无框架错误覆盖，无 console error/warn；桌面 `scrollWidth=1487`，移动项目目录 `scrollWidth=390`。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过；`pnpm test:e2e` 通过。
- 视觉验收结论：不通过。11 页当前实现均未达到源图 1:1 高保真复刻要求；总览页信息架构、项目目录 inspector/API 文档密度等与源图明显不一致。
- QA 证据：`/tmp/team-platform-qa-review-20260628/精确视口视觉对照总览.jpg`；`/tmp/team-platform-qa-review-20260628/精确视口视觉差异摘要.json`；`/tmp/team-platform-qa-review-20260628/playwright-1487x1058/`；`/tmp/team-platform-qa-review-20260628/playwright-mobile-390x900/catalog.png`。
- 交接：已向 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33` 发送 `qa_rework_handoff`，要求按 11 张源图逐页修复后重新交 QA。

## 2026-06-28 19:38 +0800 - 返工后复验

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为返工后验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认失败时退回 developer，通过时才通知 product_planner。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；桌面视口 `1487x1058`；移动视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`。
- 桌面复验：11 个 hash 均可访问，无框架错误覆盖，无应用 console error/warn；桌面 `scrollWidth=1487`；总览、项目目录和 API 文档等上一轮主要失败点已明显修复，桌面视觉基本达到可接受水平。
- 移动复验：不通过。`390x900` 项目目录页左侧侧栏宽约 `238px`，主内容仅约 `152px`，标题、筛选、表格和按钮互相遮挡或被裁切；虽然 `scrollWidth=390`，但页面不可正常阅读和操作。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过；`pnpm test:e2e` 通过。
- QA 证据：`/tmp/team-platform-qa-recheck-20260628/qa-recheck-visual-contact.jpg`；`/tmp/team-platform-qa-recheck-20260628/qa-recheck-visual-diff-summary.json`；`/tmp/team-platform-qa-recheck-20260628/playwright-1487x1058/`；`/tmp/team-platform-qa-recheck-20260628/playwright-mobile-390x900/catalog.png`。
- 交接：已向 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33` 发送 `qa_rework_handoff`，要求修复 390px 移动端目录页遮挡后重新交 QA。

## 2026-06-28 19:58 +0800 - 390px 移动端项目目录遮挡修复复验

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为移动端遮挡修复复验；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认通过时通知 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd`。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；重点移动视口 `390x900`；桌面回归视口 `1487x1058`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`。
- 移动复验：通过。`390x900` 项目目录页无页面级横向溢出，无遮挡；`scrollWidth=390`，`.app-main width=390 right=390`，`.catalog-list-panel width=366 right=378`，`.project-table .project-row width=338 right=364`，搜索控件 `width=340 right=365`。
- 桌面回归：11 个 hash 页面均可访问，无错误覆盖；桌面 `scrollWidth=1487`；控制台无应用 error/warn。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过，Web 36 项 + API 18 项；`pnpm test:e2e` 通过，5 个 Playwright 测试通过。
- QA 证据：`/tmp/team-platform-qa-mobile-final-recheck-20260628/移动端项目目录复验.png`；`/tmp/team-platform-qa-mobile-final-recheck-20260628/移动端浏览器复验摘要.json`；`/tmp/team-platform-qa-mobile-final-recheck-20260628/playwright-1487x1058/`；`/tmp/team-platform-qa-mobile-final-recheck-20260628/playwright-1487x1058/桌面11页复验摘要.json`。
- 交接：已向 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd` 发送 `qa_pass_handoff`，结论为验收通过。

## 2026-06-29 09:40 +0800 - 桌面滚动后左侧导航空白修复验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为桌面滚动侧栏缺口修复验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认通过时通知 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd`。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；桌面视口 `1992x1100`、`1487x1058`；移动回归视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`。
- 浏览器复验：通过。`1992x1100` 与 `1487x1058` 下 11 个 hash 页面滚动到底部后，`.app-sidebar position=fixed` 且覆盖完整视口高度，左下角探针命中 `aside.app-sidebar`，无页面级横向溢出。
- 关键样本：`1992x1100 #cost` 中 `.app-sidebar top=0 bottom=1100 height=1100 width=238`，`.app-main left=238 width=1754`，`scrollWidth=1992`；`1487x1058 #api-docs` 中 `.app-sidebar top=0 bottom=1058 height=1058 width=238`，`.app-main left=238 width=1249`，`scrollWidth=1487`。
- 移动回归：通过。`390x900 #catalog` 下 `scrollWidth=390`，`.app-main width=390 right=390`，`.catalog-list-panel width=366 right=378`，首个项目行 `width=338 right=364`，搜索控件 `width=340 right=365`。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过，Web 36 项 + API 18 项；`pnpm test:e2e` 通过，6 个 Playwright 测试通过。
- QA 证据：`/tmp/team-platform-sidebar-gap-qa-recheck-20260629/qa-sidebar-gap-recheck-summary.json`；`/tmp/team-platform-sidebar-gap-qa-recheck-20260629/cost-1992x1100-bottom.png`；`/tmp/team-platform-sidebar-gap-qa-recheck-20260629/api-docs-1487x1058-bottom.png`；`/tmp/team-platform-sidebar-gap-qa-recheck-20260629/catalog-390x900-mobile.png`。
- 交接：已向 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd` 发送 `qa_pass_handoff`，结论为验收通过。

## 2026-06-29 10:49 +0800 - 工作区空白整理与 API 文档入口调整验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为工作区布局与 API 文档入口调整验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认失败时退回 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；Swagger docs `http://127.0.0.1:3200/api/platform/docs`；桌面视口 `1487x1058`、`1992x1100`；移动回归视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`；Swagger docs HTTP 返回 `200 OK`。
- 通过项：10 个内部 hash 均可访问；`#api-docs` 不再渲染旧内部文档工作区；侧栏“平台 API 文档”链接指向 `/api/platform/docs`，点击后进入 `Swagger UI`；390px 项目目录和桌面固定侧栏回归通过。
- 失败项：`#health` 右侧 `.system-health-panel` 内基础设施状态卡片仍存在控件挤压/裁切；`.system-health-panel .status-list clientWidth=290`、`scrollWidth=347`，Redis 行元素右边界到 `1500.97`，超过面板右边界 `1469` 和视口宽度 `1487`。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过，Web 36 项 + API 18 项；`pnpm test:e2e` 通过，8 个 Playwright 测试通过，但现有 E2E 未覆盖该右侧状态卡片内溢出。
- QA 证据：`/tmp/team-platform-workspace-cleanup-qa-20260629/health-1487x1058.png`；`/tmp/team-platform-workspace-cleanup-qa-20260629/system-health-panel-clipping-evidence.json`；`/tmp/team-platform-workspace-cleanup-qa-20260629/qa-workspace-cleanup-summary.json`；`/tmp/team-platform-workspace-cleanup-qa-20260629/swagger-docs-clicked.png`；`/tmp/team-platform-workspace-cleanup-qa-20260629/catalog-390-mobile.png`。
- 交接：已向 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33` 发送 `qa_rework_handoff`，要求修复 `#health` 右侧基础设施卡片溢出并补充断言后重新交 QA。

## 2026-06-29 11:03 +0800 - #health 右侧基础设施卡片溢出修复验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为 `#health` 右侧基础设施卡片溢出返工验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认通过时通知 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd`。
- 验证环境：Web `http://127.0.0.1:3200`；API `http://127.0.0.1:3201`；重点页面 `http://127.0.0.1:3200/#health`；桌面视口 `1487x1058`、`1992x1100`；移动回归视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`；Swagger docs HTTP 返回 `200 OK`。
- 重点复验：通过。`#health` 右侧 `.system-health-panel right=1469 width=340`，`.status-list clientWidth=290 scrollWidth=290`，四个 `.status-row right=1444`，均小于面板右边界；页面 `scrollWidth=1487`，无页面级横向溢出。
- 回归验证：10 个内部工作区均可访问且未恢复内部 `#api-docs` 工作区；侧栏“平台 API 文档”点击进入 `/api/platform/docs`，页面标题为 `Swagger UI`；`390x900 #catalog` 移动端回归通过；`1992x1100 #cost` 桌面固定侧栏滚动到底部回归通过。
- 浏览器控制台：无应用相关 error/warn。浏览器工具自身出现过一次外部 Statsig 请求超时，不属于本地应用日志。
- 命令验证：`pnpm typecheck` 通过；`pnpm test` 通过，Web 36 项 + API 18 项；`pnpm test:e2e` 通过，8 个 Playwright 测试通过。
- QA 证据：`/tmp/team-platform-health-panel-fix-qa-20260629/qa-health-panel-fix-regression-summary.json`；`/tmp/team-platform-health-panel-fix-qa-20260629/health-1487-fixed-qa.png`；`/tmp/team-platform-health-panel-fix-qa-20260629/health-panel-qa-summary.json`；`/tmp/team-platform-health-panel-fix-qa-20260629/swagger-docs-qa.png`；`/tmp/team-platform-health-panel-fix-qa-20260629/catalog-390-mobile-top-qa.png`；`/tmp/team-platform-health-panel-fix-qa-20260629/cost-1992-sidebar-regression.png`。
- 交接：已向 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd` 发送 `qa_pass_handoff`，结论为验收通过。

## 2026-06-29 14:43 +0800 - 全项目真实性复验返工验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为全项目真实性复验返工验收；`may_modify_business_code=false`，未修改业务代码。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认通过时通知 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd`。
- AGENTS 约束：项目根目录缺少 `agent_memory/`，且本机 `~/.codex/templates/agent_memory/` 不存在；未临时发明模板结构，继续按团队规则维护 `agents/qa/log.md` 与 `agents/messages.jsonl`。
- 验证环境：Web `http://localhost:3200`；API `http://localhost:3201`；Swagger `http://localhost:3200/api/platform/docs`；桌面视口 `1487x1058`、`1992x1100`；移动回归视口 `390x900`。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`；Swagger docs HTTP 返回 `200 OK`。
- API 对照：通过 Web 代理 API 登录后，`/projects?page=1&pageSize=50&includeArchived=false` 返回 `total=1`、唯一项目 `manjv-studio`；`/projects/manjv-studio` 返回环境 `docker`、`local`，未返回 `docker-demo`；`/governance-dashboard` 中 `alerts/deployments/costRecords/configurations/tasks/modelRoutes` 均为 `0`；`/observability-links` 为空数组。
- 静态复核：E2E 项目目录断言限定 `.project-table .project-row`；服务搜索断言限定 `.explorer-panel .explorer-item`；观测页占位为通用“观测平台链接名称”和 `https://example.com/observability/...`；manifest 默认环境 slug 为 `docker`；项目详情仅返回未归档服务/环境。
- 浏览器真实性复验：`1487x1058` 下 `#catalog`、`#governance`、`#release`、`#cost`、`#access`、`#observability` 均无样例项目、供应商假文案或 `docker-demo`；页面级 `scrollWidth` 均不超过视口宽度；顶部全局搜索、当前项目和当前环境均为 disabled。
- 交互复验：`#services` 搜索输入 `api` 后，`.explorer-panel .explorer-item` 显示真实 `Manjv Studio API Routes`，未出现 `docker-demo`；`#access` 点击“新增凭证”后出现凭证签发表单，`凭证名称`、`凭证服务`、`凭证环境` 控件存在。
- 回归验证：侧栏“平台 API 文档”点击进入 `/api/platform/docs`，页面标题为 `Swagger UI` 且未渲染 `.app-sidebar`；`390x900 #catalog` 移动端 `scrollWidth=390`、`.app-main right=390`、`.catalog-list-panel right=378`、首个项目行 `right=364`；`1992x1100 #cost` 滚动到底部后 `.app-sidebar bottom=1100 height=1100 width=238`，左下角探针命中侧栏。
- 浏览器控制台：应用日志 `tab.dev.logs({ levels: ['error','warn'] })` 返回 `[]`。浏览器工具自身出现过一次外部 Statsig 请求超时，不属于本地应用日志。
- 命令验证：`pnpm typecheck` 通过，12 个任务成功；`pnpm test` 通过，Web 36 项 + API 18 项；`pnpm test:e2e` 通过，11 个 Playwright 测试全部通过。
- QA 证据：`/tmp/team-platform-authenticity-qa-20260629/qa-final-summary.json`；`/tmp/team-platform-authenticity-qa-20260629/browser-authenticity-qa-summary.json`；`/tmp/team-platform-authenticity-qa-20260629/access-interaction-recheck.json`；`/tmp/team-platform-authenticity-qa-20260629/observability-1487x1058-qa.png`；`/tmp/team-platform-authenticity-qa-20260629/swagger-docs-1487x1058-qa.png`；`/tmp/team-platform-authenticity-qa-20260629/catalog-390x900-qa.png`；`/tmp/team-platform-authenticity-qa-20260629/cost-1992x1100-scrolled-qa.png`。
- 交接：已向 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd` 发送 `qa_pass_handoff`，结论为验收通过。

## 2026-06-29 15:28 +0800 - 仓库清理、文档更新、提交推送准备验收

- 角色门禁：当前角色 `qa_reviewer`；消息来源为 registry 中 developer 线程 `019f0b56-7969-70b1-9344-62d579b4eb33`；任务类型为仓库清理、文档更新和提交推送准备验收；`may_modify_business_code=false`，未修改业务代码、未暂存、未提交、未推送。
- 规则读取：已重新读取 `agents/TEAM_RULES.md` 与 `agents/registry.json`，确认通过时通知 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd`。
- AGENTS 约束：项目根目录缺少 `agent_memory/`，且本机 `~/.codex/templates/agent_memory/` 不存在；未临时发明模板结构，继续按团队规则维护 `agents/qa/log.md` 与 `agents/messages.jsonl`。
- Git 复核：当前分支 `main`；远端 `origin git@github.com:XueGang-AI/team-platform.git`；`git diff --cached --stat` 无输出；`git status --short` 显示 developer 交接范围内的 tracked 修改及新增 `agents/`、`design-qa.md`；QA 未执行 `git add`、`git commit` 或 `git push`。
- 清理复核：旧内部 API 文档工作区选择器 `.docs-*`、`.code-panel`、`.response-preview`、`.param-table`、`.request-*`、`.schema-*`、`.workflow-steps` 等在 `globals.css`、组件和 E2E 中无残留；只在 `design-qa.md` 保留说明性记录。
- 文档复核：`README.md`、`CLAUDE.md`、`docs/03-project-integration.md`、`docs/08-repository-architecture.md`、`docs/09-phased-technical-plan.md`、`infra/README.md` 已同步 Web/API `3200/3201`、Swagger `/api/platform/docs`、通用 PostgreSQL/Redis `15432/16379`、真实数据/空态策略、canonical `local/docker` 和 manifest apply 归档语义。
- 依赖复核：根、CLI、SDK depcheck 无未使用依赖；API/Web depcheck 报告项与 developer 保留说明一致，`pnpm why` 和配置引用可解释 `pg`、`@prisma/adapter-pg`、`pino-pretty`、`@prisma/config`、`@nestjs/schematics`、API 测试链和 Web `@types/node`；未发现 missing 依赖。
- 本地忽略物复核：`git clean -ndX` 仅 dry-run，列出 `.env`、`node_modules/`、`.turbo/`、`dist/`、`tmp/`、Playwright 产物等；QA 未执行批量删除。
- 命令验证：`pnpm typecheck` 通过，12 个任务成功；`pnpm test` 通过，API 18 项 + Web 36 项；`pnpm platform:start` 通过，迁移无待执行，构建成功并启动 Web `3200` / API `3201`；`pnpm test:e2e` 通过，11 个 Playwright 测试全部通过。
- 服务健康：`/health/live` 返回 `ok`；`/health/ready` 返回 `ok`，postgres/redis 均为 `ok`；Web 代理 `/api/platform/health/ready` 返回 `ok`；`/api/platform/docs` 返回 `200 OK`。
- 浏览器复验：`1487x1058` 下 10 个内部工作区均可访问，无框架错误覆盖、无旧内部 docs 渲染、无页面级横向溢出；Swagger 外链进入 `/api/platform/docs`，标题 `Swagger UI` 且未渲染 `.app-sidebar`；`1992x1100` 下 10 个内部工作区滚动到底部侧栏均覆盖视口；应用控制台 error/warn 为空。
- 移动复验：首次截图抓到启动加载态，未作为失败结论；等待项目目录稳定后复查通过，`390x900 #catalog` 下 `scrollWidth=390`，`.app-main right=390`，`.catalog-list-panel right=378`，首个项目行 `right=364`，搜索控件 `right=365`，无框架错误覆盖。
- QA 证据：`/tmp/team-platform-repo-cleanup-qa-20260629/qa-final-summary.json`；`/tmp/team-platform-repo-cleanup-qa-20260629/browser-regression-qa-summary.json`；`/tmp/team-platform-repo-cleanup-qa-20260629/mobile-recheck-summary.json`；`/tmp/team-platform-repo-cleanup-qa-20260629/catalog-mobile-390x900-qa-final.png`；`/tmp/team-platform-repo-cleanup-qa-20260629/swagger-docs-1487x1058-qa.png`；`/tmp/team-platform-repo-cleanup-qa-20260629/cost-scrolled-1992x1100-qa.png`；`/tmp/team-platform-repo-cleanup-qa-20260629/observability-1487x1058-qa.png`。
- 交接：已向 product_planner 线程 `019f0b56-410e-7e70-882e-ebc69657fecd` 发送 `qa_pass_handoff`，结论为验收通过。
