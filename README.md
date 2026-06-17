# 团队统一项目治理平台（team-platform）

> 面向团队多项目统一治理的内部开发者平台，提供项目注册、统一鉴权、可观测性、配置管理、告警、发布管理、任务中心、模型网关与成本治理等通用能力。

## 1. 项目是什么

team-platform 是团队内部的统一项目治理平台。在「超级个体」模式下，每个成员独立负责一个完整项目，技术栈各异，缺少统一的注册、监控与治理机制。本平台将分散在各项目的公共治理能力收口为一处。

## 2. 为什么建设

- 各项目重复开发日志、鉴权、配置、告警、任务、文件、模型调用等能力；
- 技术负责人无法在一处查看所有项目的负责人、环境、版本、健康状态、异常与资源消耗；
- 项目负责人变更或项目无人维护时，知识与运行信息易丢失。

## 3. 解决哪些问题

统一服务目录、统一身份与权限、统一可观测性入口、统一治理流程（告警/配置/密钥/发布/任务/审计）、统一接入协议（`project.yaml` + SDK + CLI）、统一成本与用量治理、知识沉淀。

## 4. 当前状态

**当前阶段：Phase 0（仓库初始化、需求梳理、总体架构与路线规划）。**

- ✅ 已完成：Git 仓库初始化、架构文档、领域模型、接入协议、技术选型、开发路线、安全原则、风险分析、ADR。
- ❌ 未实现：工程骨架、API、数据库、管理后台、SDK、CLI、可观测性组件部署等一切 Phase 1 及之后的内容。

**本仓库当前无可运行的平台服务，只有文档与基础配置。**

## 5. 总体架构概览

平台采用**模块化单体**，**控制面与数据面分离**，**优先集成成熟开源组件而非重造基础设施**。

- 控制面（自研，PostgreSQL）：项目模型、权限、配置元数据、告警规则、发布记录、审计；
- 数据面（外部组件）：Loki（日志）、Prometheus（指标）、Tempo（trace）、Grafana（Dashboard）、对象存储、外部 Secret Store；
- 平台只存维度关联索引与跳转链接，不复制全量数据面数据。

详细架构图见 [docs/01-architecture.md](./docs/01-architecture.md)。

## 6. 核心能力（规划）

项目注册与服务目录、统一身份与权限、服务身份凭证、可观测性接入、告警中心、配置与密钥中心、发布与环境管理、异步任务中心、文件服务、通知中心、功能开关、模型网关、成本与配额、Prompt 版本与评测、TypeScript/Python SDK、CLI、管理后台。

> 以上为远期规划，不代表已实现。建设顺序见 [开发路线](./docs/05-roadmap.md)。

## 7. 仓库结构

```
team-platform/
├── README.md                  # 项目入口（本文件）
├── CLAUDE.md                  # Claude Code 开发约束
├── .gitignore
├── .editorconfig
└── docs/
    ├── 00-vision-and-scope.md # 愿景与产品边界
    ├── 01-architecture.md     # 总体架构
    ├── 02-domain-model.md     # 核心领域模型
    ├── 03-project-integration.md # 项目接入协议
    ├── 04-technology-decisions.md # 技术选型
    ├── 05-roadmap.md          # 开发路线
    ├── 06-security-principles.md # 安全原则
    ├── 07-risks.md            # 风险分析
    └── adr/                   # 架构决策记录
        ├── README.md
        ├── 0001-modular-monolith.md
        ├── 0002-control-plane-data-plane.md
        └── 0003-observability-integration.md
```

> Phase 1 将在此结构下新增 `apps/`、`packages/`、`infra/` 等目录。当前不提前创建空代码目录。

## 8. 开发阶段

- Phase 0：架构与仓库初始化（当前）
- Phase 1：工程骨架与本地基础设施
- Phase 2：项目注册与服务目录
- Phase 3：身份、权限与服务凭证
- Phase 4：可观测性接入
- Phase 5：TypeScript/Python SDK 与 CLI
- Phase 6：告警中心
- Phase 7：配置与密钥中心
- Phase 8：发布与环境管理
- Phase 9：异步任务中心
- Phase 10：文件、通知、功能开关
- Phase 11：模型网关与成本配额
- Phase 12：Prompt 版本与模型评测

详见 [docs/05-roadmap.md](./docs/05-roadmap.md)。

## 9. 当前已完成内容

- Git 仓库初始化（默认分支 `main`），remote 指向 `git@github.com:XueGang-AI/team-platform.git`；
- 仓库基础配置（`.gitignore`、`.editorconfig`）；
- Phase 0 全部架构文档与 ADR；
- 项目级 `CLAUDE.md` 开发约束。

## 10. 当前尚未实现内容

- monorepo 工程骨架（pnpm workspace + Turborepo）；
- NestJS API、Next.js 管理后台；
- PostgreSQL / Redis / 可观测性组件的 Docker Compose 编排；
- 任何业务模块、API、数据库 schema、SDK、CLI；
- 登录系统、可观测性接入、告警、配置、发布、任务、模型网关等全部业务能力。

## 11. 文档导航

| 文档 | 内容 |
|------|------|
| [愿景与产品边界](./docs/00-vision-and-scope.md) | 服务对象、解决与不解决的问题、责任边界 |
| [总体架构](./docs/01-architecture.md) | 架构图、模块边界、控制面与数据面 |
| [领域模型](./docs/02-domain-model.md) | 核心实体、关系、生命周期、实现阶段 |
| [项目接入协议](./docs/03-project-integration.md) | `project.yaml`、命名规则、接入方式 |
| [技术选型](./docs/04-technology-decisions.md) | NestJS/Prisma/Turborepo 等选型分析 |
| [开发路线](./docs/05-roadmap.md) | 12 个阶段的依赖与交付 |
| [安全原则](./docs/06-security-principles.md) | 权限、隔离、密钥、审计、故障隔离 |
| [风险分析](./docs/07-risks.md) | 主要风险与控制策略 |
| [ADR 索引](./docs/adr/README.md) | 架构决策记录 |

## 12. 贡献和开发约束

- 详见 [CLAUDE.md](./CLAUDE.md)；
- 每次只执行一个 Phase，不得跨阶段开发；
- 不得以静态页面、假数据或伪实现冒充完成；
- 未真实执行验证不得声称通过；
- 文档只能描述当前真实状态，规划须明确标注；
- 不提交密钥、Token、密码和真实生产地址；
- 禁止 force push、`reset --hard`、改写历史等破坏性操作；
- 每阶段独立提交，完成后停止并报告。

## 13. 安全说明

- 密钥真实值不进入仓库与数据库，只存元数据引用，真实值在外部 Secret Store / KMS；
- `project.yaml` 与所有文件禁止写入密钥、Token、密码、含密码连接字符串；
- 用户身份与服务身份分离，禁止跨项目共享凭证；
- 平台故障不能拖垮业务，SDK 具备超时、熔断、降级、异步上报、本地缓冲、丢弃策略；
- 详见 [安全原则](./docs/06-security-principles.md)。
