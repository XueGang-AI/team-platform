# 02 - 核心领域模型

> 本文分析平台的核心领域实体、关系、生命周期与约束，并标注每个实体的实现阶段。
> 不是所有实体都会直接落地为数据库表——明细型数据走数据面，控制面只存元数据与聚合。

## 1. 模型总览

```mermaid
erDiagram
    User ||--o{ ProjectMember } : "属于"
    User ||--o{ AuditEvent : "执行"
    Team ||--o{ Project : "拥有"
    Project ||--o{ ProjectMember : "包含成员"
    Project ||--o{ Service : "包含服务"
    Project ||--o{ Environment : "包含环境"
    Project ||--o{ Configuration : "拥有配置"
    Project ||--o{ SecretMetadata : "拥有密钥元数据"
    Project ||--o{ AlertRule : "拥有告警规则"
    Project ||--o{ ProjectDependency : "依赖"
    Project ||--o{ Integration : "集成"
    Project ||--o{ UsageRecord : "用量"
    Project ||--o{ CostRecord : "成本"
    Service ||--o{ ServiceCredential : "持有凭证"
    Service ||--o{ Deployment : "部署记录"
    Service ||--o{ HealthCheck : "健康检查"
    Environment ||--o{ Deployment : "承载"
    AlertRule ||--o{ AlertEvent : "触发"
    ProjectDependency }o--|| Project : "依赖目标"
```

## 2. 实体清单与实现阶段

| 实体 | 实现阶段 | 说明 |
|------|----------|------|
| User | Phase 2 | 平台统一用户 |
| Team | Phase 2 | 组织单位（可选，初期可单团队） |
| Project | Phase 2 | 核心实体，一切关联中心 |
| ProjectMember | Phase 2 | 项目成员 |
| ProjectRole | Phase 2 | 角色与权限定义 |
| Service | Phase 2 | 项目下服务 |
| Environment | Phase 2 | 环境 |
| ServiceCredential | Phase 3 | 服务身份凭证 |
| AuditEvent | Phase 3 起持续 | 审计事件 |
| Deployment | Phase 8 | 部署记录 |
| HealthCheck | Phase 4 | 健康检查 |
| Configuration | Phase 7 | 配置 |
| SecretMetadata | Phase 7 | 密钥元数据 |
| AlertRule | Phase 6 | 告警规则 |
| AlertEvent | Phase 6 | 告警事件 |
| Task | Phase 9 | 异步任务 |
| FileObject | Phase 10 | 文件对象 |
| Notification | Phase 10 | 通知 |
| FeatureFlag | Phase 10 | 功能开关 |
| ModelRoute | Phase 11 | 模型路由 |
| UsageRecord | Phase 11 | 用量记录 |
| CostRecord | Phase 11 | 成本记录 |
| PromptVersion | Phase 12 | Prompt 版本 |
| Integration | 未来设计 | 外部集成 |
| ProjectDependency | 未来设计 | 项目间依赖 |

## 3. 核心实体详述

### 3.1 User（用户）

- **核心字段**：`id`, `email`, `name`, `avatar_url`, `status`(active/disabled), `created_at`
- **关系**：通过 ProjectMember 关联多个 Project；执行 AuditEvent
- **生命周期**：创建 → active → disabled。禁止物理删除，disabled 后保留审计可追溯
- **约束**：`email` 全局唯一

### 3.2 Team（团队）

- **核心字段**：`id`, `name`, `slug`, `description`
- **关系**：拥有多个 Project
- **生命周期**：初期可单团队；多团队需求出现后启用
- **约束**：`slug` 全局唯一

### 3.3 Project（项目）— 核心

- **核心字段**：`id`, `name`, `slug`, `display_name`, `type`(web/api/worker/scheduler/ai-service/data), `description`, `owner_id`, `repo_url`, `tags[]`, `status`, `created_at`, `updated_at`
- **关系**：1 对多 Service / Environment / ProjectMember / Configuration / SecretMetadata / AlertRule / UsageRecord / CostRecord；多对多 Project（通过 ProjectDependency）
- **生命周期**：`active` → `maintenance` → `deprecated` → `archived`。状态流转需审计
- **约束**：`slug` 全局唯一（命名规则见 [接入协议](./03-project-integration.md#4-命名规则)）

### 3.4 ProjectMember / ProjectRole

- **ProjectMember 核心字段**：`project_id`, `user_id`, `role`, `joined_at`
- **ProjectRole**：枚举 `owner` / `maintainer` / `developer` / `viewer`，对应权限集合
- **约束**：`(project_id, user_id)` 唯一；每个项目至少一个 owner
- **说明**：先用项目级 RBAC，未来按需扩展 ABAC，避免一开始就过度复杂

### 3.5 Service（服务）

- **核心字段**：`id`, `project_id`, `name`, `type`, `language`, `description`, `created_at`
- **关系**：1 对多 ServiceCredential / Deployment / HealthCheck
- **约束**：`(project_id, name)` 唯一；`name` 用 kebab-case

### 3.6 Environment（环境）

- **核心字段**：`id`, `project_id`, `name`(dev/staging/prod/自定义), `config_ref`, `created_at`
- **关系**：与 Deployment 关联（某服务在某环境的部署）
- **约束**：`(project_id, name)` 唯一

### 3.7 ServiceCredential（服务凭证）

- **核心字段**：`id`, `service_id`, `environment`, `credential_type`, `secret_ref`(指向外部 Store), `status`(active/rotated/revoked), `issued_at`, `rotated_at`, `expires_at`
- **关系**：属于 Service
- **生命周期**：签发 → active → rotated/revoked。轮换与吊销留审计
- **约束**：凭证真实值不进数据库，只存 `secret_ref`；禁止跨项目共享凭证

### 3.8 AuditEvent（审计事件）— 独立

- **核心字段**：`id`, `actor_id`, `actor_type`(user/service), `action`, `target_type`, `target_id`, `project_id`, `payload`(脱敏), `ip`, `created_at`
- **关系**：关联 actor 与 target，但**独立存储**，不与业务表强耦合
- **约束**：只增不改；payload 必须脱敏（移除密钥/Token/密码字段）；保留周期按策略

### 3.9 Deployment（部署记录）

- **核心字段**：`id`, `service_id`, `environment`, `version`, `commit_ref`, `deployed_at`, `status`(success/failed/rolled-back), `deployed_by`
- **关系**：属于 Service，关联 Environment
- **说明**：平台只记录部署事件，不执行部署

### 3.10 HealthCheck（健康检查）

- **核心字段**：`id`, `service_id`, `environment`, `endpoint`, `status`(healthy/degraded/down), `last_checked_at`, `latency_ms`
- **说明**：探测结果存控制面（轻量），明细探测历史走数据面

### 3.11 Configuration（配置）

- **核心字段**：`id`, `project_id`, `environment`, `key`, `value`(或 `value_ref`), `version`, `schema`, `updated_by`
- **约束**：`(project_id, environment, key, version)` 唯一；版本化，可回滚

### 3.12 SecretMetadata（密钥元数据）

- **核心字段**：`id`, `project_id`, `key`, `external_ref`, `current_version`, `rotation_policy`, `last_rotated_at`
- **说明**：**不存真实密钥值**。`external_ref` 指向外部 Secret Store / KMS 的引用
- **约束**：轮换策略可配置；轮换事件入审计

### 3.13 AlertRule / AlertEvent

- **AlertRule**：`id`, `project_id`, `name`, `metric`, `condition`, `threshold`, `severity`, `notify_channels[]`, `enabled`
- **AlertEvent**：`id`, `rule_id`, `fired_at`, `resolved_at`, `severity`, `context`
- **说明**：规则存控制面；告警评估可基于 Prometheus 数据，事件落库用于追溯

### 3.14 用量与成本（Phase 11）

- **UsageRecord**：`id`, `project_id`, `service_id`, `resource_type`(model/api/storage), `quantity`, `period`, `recorded_at`
- **CostRecord**：`id`, `project_id`, `period`, `amount`, `currency`, `breakdown`
- **说明**：明细逐条调用进时序库（数据面），控制面只存**聚合汇总**，避免控制面数据膨胀

### 3.15 未来设计实体

- **Integration**：`project_id`, `type`(slack/github/...), `config`, `status`。外部集成的配置实体
- **ProjectDependency**：`project_id`, `depends_on_project_id`, `type`。用于项目调用拓扑与影响面分析
- **PromptVersion**（Phase 12）：`project_id`, `name`, `version`, `content_ref`, `metadata`

## 4. 不机械建表的原则

1. **明细型高频数据不进控制面**：原始日志、指标点、Trace span、逐条模型调用明细进数据面，控制面只存元数据与聚合。
2. **真实密钥不进数据库**：只存 `secret_ref` 元数据。
3. **审计独立**：AuditEvent 不与业务表强外键耦合，保证审计可追溯且不被业务变更影响。
4. **未到阶段的实体不提前建表**：避免无依据的空表。实体定义先行于表设计，表在对应 Phase 实现时再落地。

## 5. 相关文档

- [总体架构](./01-architecture.md)
- [项目接入协议](./03-project-integration.md)
- [开发路线](./05-roadmap.md)
