/**
 * @team-platform/contracts
 *
 * 跨应用共享的类型与常量契约。Phase 2 新增项目注册与服务目录相关契约。
 * 被 apps/api（产出）与 apps/web（消费）共同使用，禁止引入运行时框架依赖。
 */

// ============ Phase 1：请求 ID 与健康检查 ============

/** 请求 ID 透传 Header 名 */
export const REQUEST_ID_HEADER = 'x-request-id';

/** 单个依赖组件的就绪状态 */
export type ComponentStatusValue = 'ok' | 'degraded' | 'down';

/** 已知依赖组件名 */
export type ComponentName = 'postgres' | 'redis';

/** 组件健康检查结果 */
export interface ComponentStatus {
  name: ComponentName | string;
  status: ComponentStatusValue;
  latencyMs?: number;
  error?: string;
}

/** GET /health/live 响应 */
export interface LiveResponse {
  status: 'ok';
  timestamp: string;
}

/** GET /health/ready 响应 */
export interface ReadyResponse {
  status: ComponentStatusValue;
  checks: ComponentStatus[];
  timestamp: string;
}

/** GET /version 响应 */
export interface VersionResponse {
  name: string;
  version: string;
  environment: string;
  node: string;
}

/** 统一错误响应结构 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export function deriveOverallStatus(checks: ComponentStatus[]): ComponentStatusValue {
  if (checks.some((c) => c.status === 'down')) return 'down';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

// ============ Phase 2：枚举 ============

export type ProjectType =
  | 'WEB_APPLICATION'
  | 'API_SERVICE'
  | 'AI_APPLICATION'
  | 'DATA_SERVICE'
  | 'INTERNAL_TOOL'
  | 'OTHER';

export type ProjectStatus = 'ACTIVE' | 'MAINTENANCE' | 'ARCHIVED';

export type ServiceType =
  | 'WEB'
  | 'API'
  | 'WORKER'
  | 'SCHEDULER'
  | 'MODEL_SERVICE'
  | 'DATA_SERVICE'
  | 'OTHER';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type HealthStatus = 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY';

// ============ Phase 3：身份、权限、凭证、审计 ============

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type ProjectRole = 'OWNER' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER';
export type ServiceCredentialStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED';
export type ActorType = 'USER' | 'SERVICE' | 'SYSTEM';
export type ObservabilitySignal = 'LOGS' | 'METRICS' | 'TRACES' | 'DASHBOARD';
export type GovernanceRecordKind =
  | 'ALERT_RULE'
  | 'ALERT_EVENT'
  | 'CONFIGURATION'
  | 'SECRET_METADATA'
  | 'DEPLOYMENT'
  | 'TASK'
  | 'FILE_OBJECT'
  | 'NOTIFICATION'
  | 'FEATURE_FLAG'
  | 'MODEL_ROUTE'
  | 'USAGE_RECORD'
  | 'COST_RECORD'
  | 'PROMPT_VERSION'
  | 'EVALUATION_RUN';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface LoginBody {
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

export interface ProjectMemberDTO {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  updatedAt: string;
  user: UserDTO;
}

export interface UpsertProjectMemberBody {
  email: string;
  name: string;
  role: ProjectRole;
}

export interface ServiceCredentialDTO {
  id: string;
  serviceId: string;
  environmentSlug: string;
  name: string;
  status: ServiceCredentialStatus;
  issuedAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdByUserId: string | null;
}

export interface ServiceCredentialWithTokenDTO extends ServiceCredentialDTO {
  token: string;
}

export interface CreateServiceCredentialBody {
  serviceId: string;
  environmentSlug: string;
  name: string;
  expiresAt?: string;
}

export interface AuditEventDTO {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  projectId: string | null;
  payload: unknown;
  ip: string | null;
  createdAt: string;
}

export interface ObservabilityLinkDTO {
  id: string;
  projectId: string;
  serviceId: string | null;
  environmentSlug: string | null;
  signal: ObservabilitySignal;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateObservabilityLinkBody {
  serviceId?: string;
  environmentSlug?: string;
  signal: ObservabilitySignal;
  title: string;
  url: string;
}

export interface GovernanceRecordDTO {
  id: string;
  projectId: string;
  serviceId: string | null;
  environmentSlug: string | null;
  kind: GovernanceRecordKind;
  name: string;
  status: string;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGovernanceItemBody {
  serviceId?: string;
  environmentSlug?: string;
  name: string;
  status: string;
  data?: unknown;
}

export interface CreateGovernanceRecordBody {
  serviceId?: string;
  environmentSlug?: string;
  kind: GovernanceRecordKind;
  name: string;
  status: string;
  data?: unknown;
}

export interface UpdateGovernanceRecordBody {
  name?: string;
  status?: string;
  data?: unknown;
}

export interface GovernanceDashboardDTO {
  summary: {
    activeAlerts: number;
    openDeployments: number;
    monthlyCostCents: number;
    activeModelRoutes: number;
    configurationItems: number;
    secretReferences: number;
  };
  alerts: GovernanceRecordDTO[];
  deployments: GovernanceRecordDTO[];
  configurations: GovernanceRecordDTO[];
  secretReferences: GovernanceRecordDTO[];
  costRecords: GovernanceRecordDTO[];
  modelRoutes: GovernanceRecordDTO[];
  tasks: GovernanceRecordDTO[];
  promptEvaluations: GovernanceRecordDTO[];
}

/** slug 命名规则：小写 kebab-case */
export const SLUG_PATTERN = '^[a-z][a-z0-9-]{1,62}$';
export const SLUG_REGEX = /^[a-z][a-z0-9-]{1,62}$/;

/** Manifest Schema 版本 */
export const MANIFEST_API_VERSION = 'team-platform.io/v1alpha1';
export const MANIFEST_KIND = 'Project';

// ============ Phase 2：DTO ============

export interface ProjectDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: ProjectType;
  status: ProjectStatus;
  ownerName: string;
  ownerEmail: string | null;
  repositoryUrl: string | null;
  documentationUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ServiceDTO {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  type: ServiceType;
  description: string | null;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface EnvironmentDTO {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description: string | null;
  status: EnvironmentStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ServiceEndpointDTO {
  id: string;
  serviceId: string;
  environmentId: string;
  baseUrl: string;
  healthCheckPath: string | null;
  healthCheckEnabled: boolean;
  lastHealthStatus: HealthStatus;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 项目详情：含服务、环境、端点 */
export interface ProjectDetailDTO extends ProjectDTO {
  services: ServiceDTO[];
  environments: EnvironmentDTO[];
  endpoints: ServiceEndpointDTO[];
}

// ============ Phase 2：分页 ============

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============ Phase 2：项目查询 ============

export interface ProjectListQuery extends PageQuery {
  search?: string;
  status?: ProjectStatus;
  type?: ProjectType;
  owner?: string;
  tag?: string;
  includeArchived?: boolean;
  sort?: ProjectSortField;
  order?: 'asc' | 'desc';
}

export type ProjectSortField = 'createdAt' | 'updatedAt' | 'name' | 'slug';

// ============ Phase 2：请求体 ============

export interface CreateProjectBody {
  slug: string;
  name: string;
  description?: string;
  type: ProjectType;
  ownerName: string;
  ownerEmail?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  tags?: string[];
}

export interface UpdateProjectBody {
  name?: string;
  description?: string | null;
  type?: ProjectType;
  status?: ProjectStatus;
  ownerName?: string;
  ownerEmail?: string | null;
  repositoryUrl?: string | null;
  documentationUrl?: string | null;
  tags?: string[];
}

export interface CreateServiceBody {
  slug: string;
  name: string;
  type: ServiceType;
  description?: string;
}

export interface UpdateServiceBody {
  name?: string;
  type?: ServiceType;
  description?: string | null;
  status?: ServiceStatus;
}

export interface CreateEnvironmentBody {
  slug: string;
  name: string;
  description?: string;
}

export interface UpdateEnvironmentBody {
  name?: string;
  description?: string | null;
  status?: EnvironmentStatus;
}

export interface CreateServiceEndpointBody {
  serviceId: string;
  environmentId: string;
  baseUrl: string;
  healthCheckPath?: string;
  healthCheckEnabled?: boolean;
}

export interface UpdateServiceEndpointBody {
  baseUrl?: string;
  healthCheckPath?: string | null;
  healthCheckEnabled?: boolean;
}

// ============ Phase 2：Manifest ============

export interface ManifestOwner {
  name: string;
  email?: string;
}

export interface ManifestService {
  slug: string;
  name: string;
  type: ServiceType;
  description?: string;
}

export interface ManifestEnvironment {
  slug: string;
  name: string;
  description?: string;
}

export interface ManifestHealthCheck {
  enabled: boolean;
  path?: string;
}

export interface ManifestEndpoint {
  service: string;
  environment: string;
  baseUrl: string;
  healthCheck?: ManifestHealthCheck;
}

export interface ProjectManifest {
  apiVersion: typeof MANIFEST_API_VERSION;
  kind: typeof MANIFEST_KIND;
  metadata: {
    slug: string;
    name: string;
    description?: string;
    labels?: Record<string, string>;
  };
  spec: {
    type: ProjectType;
    owner: ManifestOwner;
    repository?: {
      url: string;
    };
    documentation?: {
      url: string;
    };
    services: ManifestService[];
    environments: ManifestEnvironment[];
    endpoints: ManifestEndpoint[];
  };
}

/** Manifest 校验结果 */
export interface ManifestValidationResult {
  valid: boolean;
  apiVersion: string;
  errors: ManifestFieldError[];
  warnings: string[];
  normalized: ProjectManifest | null;
  existingProjectSlug: string | null;
}

export interface ManifestFieldError {
  path: string;
  message: string;
}

/** Manifest Apply 结果 */
export interface ManifestApplyResult {
  applied: boolean;
  projectSlug: string;
  summary: {
    created: { projects: number; services: number; environments: number; endpoints: number };
    updated: { projects: number; services: number; environments: number; endpoints: number };
    unchanged: { projects: number; services: number; environments: number; endpoints: number };
  };
  projectId: string;
}

// ============ Phase 2：健康检查结果 ============

export interface HealthCheckResultDTO {
  endpointId: string;
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  errorCode: string | null;
}

// ============ Phase 2：业务错误码 ============

export const ErrorCode = {
  // 通用
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // 项目
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_SLUG_CONFLICT: 'PROJECT_SLUG_CONFLICT',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  // 服务
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  SERVICE_SLUG_CONFLICT: 'SERVICE_SLUG_CONFLICT',
  // 环境
  ENVIRONMENT_NOT_FOUND: 'ENVIRONMENT_NOT_FOUND',
  ENVIRONMENT_SLUG_CONFLICT: 'ENVIRONMENT_SLUG_CONFLICT',
  // 端点
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  ENDPOINT_RELATION_INVALID: 'ENDPOINT_RELATION_INVALID',
  ENDPOINT_CONFLICT: 'ENDPOINT_CONFLICT',
  // Manifest
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  MANIFEST_VERSION_UNSUPPORTED: 'MANIFEST_VERSION_UNSUPPORTED',
  MANIFEST_APPLY_FAILED: 'MANIFEST_APPLY_FAILED',
  // 健康检查
  HEALTH_CHECK_HOST_NOT_ALLOWED: 'HEALTH_CHECK_HOST_NOT_ALLOWED',
  HEALTH_CHECK_TIMEOUT: 'HEALTH_CHECK_TIMEOUT',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  // 身份权限
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_REQUIRED: 'AUTH_TOKEN_REQUIRED',
  USER_DISABLED: 'USER_DISABLED',
  PROJECT_MEMBER_NOT_FOUND: 'PROJECT_MEMBER_NOT_FOUND',
  PROJECT_MEMBER_CONFLICT: 'PROJECT_MEMBER_CONFLICT',
  PROJECT_ACCESS_DENIED: 'PROJECT_ACCESS_DENIED',
  // 服务凭证与审计
  SERVICE_CREDENTIAL_NOT_FOUND: 'SERVICE_CREDENTIAL_NOT_FOUND',
  SERVICE_CREDENTIAL_REVOKED: 'SERVICE_CREDENTIAL_REVOKED',
  // 可观测性
  OBSERVABILITY_LINK_NOT_FOUND: 'OBSERVABILITY_LINK_NOT_FOUND',
  // 治理记录
  GOVERNANCE_RECORD_NOT_FOUND: 'GOVERNANCE_RECORD_NOT_FOUND',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
