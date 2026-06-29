# 03 - 项目接入协议

> 本文定义当前平台真实支持的 `project.yaml` 接入协议、命名规则、校验方式和各接入方式职责。
> 目标：让 TypeScript、Python 以及未来其他语言项目都能以一致、低侵入的方式接入平台，而不被 team-platform 自身技术栈锁死。

## 1. 接入方式

| 接入方式 | 当前状态 | 职责 |
|----------|----------|------|
| `project.yaml` | 已实现 | 声明项目、服务、环境、端点等控制面元数据 |
| 平台 API | 已实现 | 管理后台、CLI、SDK、CI/CD 调用的统一后端 |
| 管理后台 | 已实现 | 查看项目目录、服务、环境、健康状态、可观测性入口、治理中枢 |
| CLI | 已实现 | 登录、manifest 校验/apply、项目查询、治理记录创建与治理总览 |
| TypeScript SDK | 已实现 | 封装登录、项目查询、manifest、治理 API |
| Python SDK | 已实现 | 封装登录、项目查询、manifest、治理 API |
| Webhook | 预留 | CI/CD、Alertmanager、外部任务系统上报事件 |
| OpenTelemetry | 已提供本地数据面骨架 | 日志、指标、Trace 通过 OTel/Loki/Prometheus/Tempo/Grafana 接入 |

SDK 和 CLI 只封装协议，不承载业务逻辑；项目仍可继续使用自己的语言、框架、CI/CD、模型 provider 和运行环境。

## 2. project.yaml 当前版本

当前版本为：

```yaml
apiVersion: team-platform.io/v1alpha1
kind: Project
```

平台 API 通过 `POST /project-manifests/validate` 校验，通过 `POST /project-manifests/apply` 幂等应用。apply 的语义是：项目、服务、环境和端点已存在则更新，缺失则创建；同项目内 manifest 不再声明的服务和环境会被软归档并从默认项目详情中隐藏，不做物理删除。仍保留在 manifest 中的服务/环境下，未声明的旧端点不会被物理删除。

## 3. 字段定义

### 3.1 根字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiVersion` | string | 是 | 当前固定为 `team-platform.io/v1alpha1` |
| `kind` | string | 是 | 当前固定为 `Project` |
| `metadata` | object | 是 | 项目 slug、展示名、标签 |
| `spec` | object | 是 | 项目负责人、仓库、服务、环境、端点 |

### 3.2 metadata

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 项目唯一标识，小写 kebab-case |
| `name` | string | 是 | 项目展示名 |
| `labels` | object | 否 | 键值标签，apply 时规范化为 `key:value` 标签 |

### 3.3 spec

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | `WEB_APPLICATION` / `API_SERVICE` / `AI_APPLICATION` / `DATA_SERVICE` / `INTERNAL_TOOL` / `OTHER` |
| `owner.name` | string | 是 | 项目负责人 |
| `owner.email` | string | 是 | 项目负责人邮箱 |
| `repository.url` | string | 否 | 仓库地址，可为 `https://`、`git@` 或本地 `file://` |
| `documentation.url` | string | 否 | 文档地址 |
| `services` | list | 是 | 服务列表 |
| `environments` | list | 是 | 环境列表 |
| `endpoints` | list | 否 | 服务端点与健康检查 |

### 3.4 services

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 服务唯一标识，项目内唯一 |
| `name` | string | 是 | 服务展示名 |
| `type` | string | 是 | `WEB` / `API` / `WORKER` / `SCHEDULER` / `MODEL_SERVICE` / `DATA_SERVICE` / `OTHER` |
| `description` | string | 否 | 服务说明 |

### 3.5 environments

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 环境唯一标识，如 `local`、`dev`、`staging`、`prod` |
| `name` | string | 是 | 环境展示名 |
| `description` | string | 否 | 环境说明 |

### 3.6 endpoints

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `service` | string | 是 | 引用 `services[].slug` |
| `environment` | string | 是 | 引用 `environments[].slug` |
| `baseUrl` | string | 是 | 服务基础地址 |
| `healthCheck.enabled` | boolean | 否 | 是否启用健康检查 |
| `healthCheck.path` | string | 否 | 健康检查路径 |

健康检查会受 API 环境变量 `HEALTH_CHECK_ALLOWED_HOSTS` 限制，避免 SSRF。manifest 只声明端点，不会自动绕过平台 allowlist。

## 4. 命名规则

- 项目 slug：`^[a-z][a-z0-9-]{1,62}$`，小写 kebab-case，全局唯一；
- 服务 slug：同项目 slug 规则，项目内唯一；
- 环境 slug：建议使用 `local` / `dev` / `staging` / `prod` / `docker`，小写且不含空格；
- 标签：建议使用稳定业务维度，如 `domain:ai-video`、`language:typescript`、`runtime:nextjs`。

## 5. 敏感信息禁止写入

以下内容严禁出现在 `project.yaml` 或任何仓库文件中：

- 密码、口令；
- API Key / Token / Bearer 凭证；
- 私钥、证书私钥；
- 含密码的连接字符串；
- 真实生产内部地址与内网 IP（如必须，用占位符）；
- 个人隐私数据。

密钥只允许通过治理中枢登记 `SECRET_METADATA` 这类外部引用，不保存真实值。生产环境应接入外部 Secret Store / KMS。

## 6. 校验与应用

CLI：

```bash
node apps/cli/dist/index.js validate examples/project-manifests/manjv-studio.yaml --api http://localhost:3201
node apps/cli/dist/index.js apply examples/project-manifests/manjv-studio.yaml --api http://localhost:3201 --token "$TEAM_PLATFORM_TOKEN"
```

API：

```http
POST /project-manifests/validate
POST /project-manifests/apply
```

校验项包括：

- 根字段、必填字段、枚举值；
- slug 命名规则；
- endpoint 对 service/environment 的引用合法性；
- 疑似密钥、Token、含密码连接串扫描；
- apply 幂等更新，不重复创建已存在的项目、服务、环境、端点；
- apply 会软归档同项目内 manifest 不再声明的服务和环境，避免旧环境或旧服务继续以真实资源身份出现在当前工作台。

## 7. 当前完整示例

`examples/project-manifests/manjv-studio.yaml` 是已用于真实接入测试的 TypeScript / Next.js 项目示例，覆盖 Web、API Routes、Worker、事件层和模型适配层：

```yaml
apiVersion: team-platform.io/v1alpha1
kind: Project

metadata:
  slug: manjv-studio
  name: Manjv Studio
  labels:
    domain: ai-video
    language: typescript
    runtime: nextjs

spec:
  type: AI_APPLICATION
  owner:
    name: XueGang-AI
    email: example@example.com
  repository:
    url: file:///Users/xuegang/Desktop/My%20Project/manjv-studio
  documentation:
    url: file:///Users/xuegang/Desktop/My%20Project/manjv-studio/README.md
  services:
    - slug: web
      name: Manjv Studio Web
      type: WEB
    - slug: api
      name: Manjv Studio API Routes
      type: API
    - slug: worker
      name: Manjv Studio Worker
      type: WORKER
    - slug: model-adapters
      name: Model Adapters
      type: MODEL_SERVICE
  environments:
    - slug: local
      name: 本地开发
    - slug: docker
      name: Docker 演示
  endpoints:
    - service: web
      environment: local
      baseUrl: http://localhost:3100
      healthCheck:
        enabled: true
        path: /api/health
```

完整文件见：

- `examples/project-manifests/manjv-studio.yaml`
- `/Users/xuegang/Desktop/My Project/manjv-studio/project.yaml`

## 8. 治理接入协议

项目完成 manifest 接入后，可通过平台 API/SDK/CLI 写入治理中枢记录：

- 告警：`POST /projects/:slug/alerts/rules`、`POST /projects/:slug/alerts/events`；
- 发布：`POST /projects/:slug/deployments`；
- 配置/密钥：`POST /projects/:slug/configurations`、`POST /projects/:slug/secret-references`；
- 成本/模型：`POST /projects/:slug/cost-records`、`POST /projects/:slug/model-routes`；
- Prompt/评测：`POST /projects/:slug/prompt-versions`、`POST /projects/:slug/evaluation-runs`；
- 总览：`GET /projects/:slug/governance-dashboard`。

底层当前使用统一 `GovernanceRecord` 控制面模型保存低频治理元数据。日志明细、指标点、Trace span、大文件内容、真实密钥值、逐条模型调用明细不进入 PostgreSQL。

## 9. 相关文档

- [总体架构](./01-architecture.md)
- [领域模型](./02-domain-model.md)
- [安全原则](./06-security-principles.md)
- [分阶段技术方案](./09-phased-technical-plan.md)
