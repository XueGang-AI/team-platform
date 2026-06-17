# 03 - 项目接入协议

> 本文定义统一的 `project.yaml` 接入协议、命名规则、校验方式、向后兼容策略，以及各接入方式的职责分工。
> 目标：让任意技术栈的项目都能以一致、低侵入的方式接入平台。

## 1. project.yaml 设计目标

- **声明式**：项目元数据以 YAML 声明，可纳入项目仓库或由管理后台维护；
- **可校验**：平台提供 schema 校验，CI 集成；
- **向后兼容**：通过 `schema_version` 控制兼容性；
- **安全**：敏感信息禁止写入，只能引用外部 Store。

## 2. Schema 版本与兼容策略

- 当前 `schema_version: 1`；
- **Minor 升级**：新增可选字段，不破坏旧解析器，旧接入方无需改动；
- **Major 升级**：破坏性变更（字段重命名、必填变更、语义改变），需要迁移；
- 平台按 `schema_version` 路由对应解析器，旧版本在过渡期内继续支持；
- 重大变更必须伴随 ADR 与迁移指南。

## 3. 字段定义

### 3.1 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `schema_version` | integer | Schema 版本，当前 `1` |
| `name` | string | 项目 slug，全局唯一，见命名规则 |
| `display_name` | string | 项目展示名 |
| `owner` | string | 项目负责人标识（平台用户） |
| `type` | string | 项目类型：`web` / `api` / `worker` / `scheduler` / `ai-service` / `data` |
| `repository` | string | 代码仓库地址 |

### 3.2 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string | 项目说明 |
| `tags` | string[] | 标签 |
| `services` | list | 服务列表，见 3.3 |
| `environments` | list | 环境列表，见 3.4 |
| `dependencies` | list | 项目间依赖 |
| `integrations` | object | 平台能力开关与集成配置，见 3.5 |

### 3.3 services 子结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务 slug，项目内唯一 |
| `type` | string | 服务类型 |
| `language` | string | 实现语言 |
| `health_check` | object | 健康检查端点、间隔 |
| `observability` | object | 日志/指标/trace 配置 |

### 3.4 environments 子结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 环境名：`dev` / `staging` / `prod` / 自定义 |
| `vars_ref` | string | 环境变量引用（指向外部，非明文值） |

### 3.5 integrations 子结构（平台能力开关）

```yaml
integrations:
  observability:
    enabled: true
    logs: true
    metrics: true
    traces: true
  alerting:
    enabled: true
  config:
    enabled: false
  secrets:
    enabled: false
    store: external  # 真实值不在本文件
```

## 4. 命名规则

- **项目 slug（name）**：`^[a-z][a-z0-9-]{1,62}$`，小写 kebab-case，全局唯一；
- **服务 slug（services[].name）**：同上规则，项目内唯一；
- **环境名**：优先使用 `dev` / `staging` / `prod`，自定义环境须小写、不含空格；
- **标签**：小写，`key` 或 `key:value` 形式。

## 5. 敏感信息禁止写入清单

以下内容**严禁**出现在 `project.yaml` 或任何仓库文件中：

- 密码、口令；
- API Key / Token / Bearer 凭证；
- 私钥、证书私钥；
- 含密码的连接字符串；
- 真实生产内部地址与内网 IP（如必须，用占位符）；
- 个人隐私数据。

这些只能通过 `SecretMetadata` 引用外部 Secret Store / KMS，在 `project.yaml` 中只写引用名（如 `vars_ref`、`store: external`），不写值。

## 6. 校验方式

- 平台提供 CLI：`team-platform validate <path-to-project.yaml>`；
- 校验基于 JSON Schema（与 `schema_version` 对应）；
- 校验项：必填字段、命名规则、枚举值、引用合法性、敏感信息扫描（禁止出现疑似密钥模式）；
- CI 集成：在项目流水线中调用 CLI 校验，阻断不合规提交。

## 7. 完整示例

> 以下为示例，所有值均为占位，不含任何真实密钥或生产地址。

```yaml
schema_version: 1

name: order-service
display_name: 订单服务
description: 团队订单核心服务
owner: alice
type: api
repository: git@github.com:example-team/order-service.git
tags:
  - domain:trade
  - tier:1

services:
  - name: order-api
    type: web
    language: typescript
    health_check:
      endpoint: /healthz
      interval_seconds: 15
    observability:
      logs: true
      metrics: true
      traces: true
  - name: order-worker
    type: worker
    language: typescript
    observability:
      logs: true
      metrics: true

environments:
  - name: dev
    vars_ref: ext://secret-store/order-service/dev
  - name: staging
    vars_ref: ext://secret-store/order-service/staging
  - name: prod
    vars_ref: ext://secret-store/order-service/prod

dependencies:
  - project: payment-service
    type: runtime

integrations:
  observability:
    enabled: true
    logs: true
    metrics: true
    traces: true
  alerting:
    enabled: true
  config:
    enabled: false
  secrets:
    enabled: true
    store: external
```

## 8. 接入方式职责分工

| 接入方式 | 职责 | 第一期必须 |
|----------|------|------------|
| `project.yaml` | 声明式项目元数据，CI/手工同步到平台 | 是（Phase 2 校验） |
| 管理后台手工注册 | UI 录入项目与服务，兜底方式 | 是（Phase 2） |
| 平台 API | 所有接入方式底层都走 API，对外稳定契约 | 是（Phase 2） |
| TypeScript SDK | 运行时能力：结构化日志、指标上报、trace 注入、配置拉取、鉴权、模型网关调用 | 否（Phase 5） |
| Python SDK | 同 TS SDK 能力的 Python 版本 | 否（Phase 5） |
| CLI | 管理操作：注册、校验、发布记录、密钥轮换、查询状态 | 否（Phase 5） |
| CI/CD Webhook | 部署事件上报（version、commit、环境、状态） | 否（Phase 8） |
| OpenTelemetry | 可观测性数据采集标准协议，平台适配层接收并关联 | 否（Phase 4） |

### 8.1 SDK 职责边界

SDK 只做**协议封装与运行时能力**，不承担业务逻辑：

- 注入统一维度标签（`project_id` / `environment` / `service_name` / `version`）；
- 结构化日志、指标、trace 上报；
- 配置拉取与缓存；
- 鉴权（携带服务凭证）；
- 模型网关调用封装；
- **故障隔离**：超时、熔断、降级、异步上报、本地缓冲、丢弃策略、重试上限、敏感信息过滤（详见 [安全原则](./06-security-principles.md#4-平台故障隔离)）。

## 9. 相关文档

- [总体架构](./01-architecture.md)
- [领域模型](./02-domain-model.md)
- [安全原则](./06-security-principles.md)
