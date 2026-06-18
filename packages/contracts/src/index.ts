/**
 * @team-platform/contracts
 *
 * 跨应用共享的类型与常量契约。Phase 1 仅包含健康检查、版本与错误结构。
 * 被 apps/api（产出）与 apps/web（消费）共同使用，禁止引入运行时框架依赖。
 */

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
  /** 检查耗时（毫秒），脱敏后可暴露 */
  latencyMs?: number;
  /** 非敏感错误描述，禁止包含密码/连接串/Token */
  error?: string;
}

/** GET /health/live 响应：仅表示进程存活 */
export interface LiveResponse {
  status: 'ok';
  timestamp: string;
}

/** GET /health/ready 响应：聚合各依赖组件就绪情况 */
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
  };
}

/**
 * 由各组件状态聚合总体就绪状态：
 * - 任一 down  → down
 * - 任一 degraded → degraded
 * - 否则 ok
 */
export function deriveOverallStatus(checks: ComponentStatus[]): ComponentStatusValue {
  if (checks.some((c) => c.status === 'down')) return 'down';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}
