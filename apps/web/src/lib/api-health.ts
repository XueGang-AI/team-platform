import type {
  ComponentStatus,
  ComponentStatusValue,
  LiveResponse,
  ReadyResponse,
} from '@team-platform/contracts';

/** API 调用超时时间（毫秒）。超出后视为降级，而非崩溃。 */
export const API_TIMEOUT_MS = 4000;

/**
 * 单个被监测目标的展示状态。
 * - `loading`：首次请求进行中
 * - `ok` / `degraded` / `down`：来自契约的组件状态值
 * - `unreachable`：网络错误、超时或非 2xx，API 不可达时的降级态
 */
export type ProbeStatus = ComponentStatusValue | 'loading' | 'unreachable';

/** Web 自身永远存活，无需外部探测。 */
export interface WebSelfStatus {
  name: 'web';
  status: 'ok';
}

/** API liveness 探测结果。 */
export interface ApiLivenessStatus {
  name: 'api';
  status: ProbeStatus;
  /** 探测耗时（毫秒），不可达或 loading 时为 undefined。 */
  latencyMs?: number;
  /** 非敏感错误描述。 */
  error?: string;
}

/** 依赖组件（postgres / redis）探测结果，从 /health/ready 的 checks 中提取。 */
export interface DependencyStatus {
  name: string;
  status: ProbeStatus;
  latencyMs?: number;
  error?: string;
}

/** 首页仪表盘聚合状态。 */
export interface DashboardStatus {
  web: WebSelfStatus;
  api: ApiLivenessStatus;
  postgres: DependencyStatus;
  redis: DependencyStatus;
  /** 整体就绪状态，由各探测项聚合。 */
  overall: ComponentStatusValue;
  /** 服务端渲染时间戳，供客户端对照是否刷新。 */
  fetchedAt: string;
}

/** fetch 前后计时，返回毫秒整数。 */
function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

/**
 * 带超时的 fetch 封装。超时或网络错误时返回 `{ ok: false }`，
 * 调用方据此展示降级状态，不抛异常打断渲染。
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs = API_TIMEOUT_MS,
): Promise<{ ok: true; res: Response } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    return { ok: true, res };
  } catch (err) {
    const reason =
      err instanceof DOMException && err.name === 'AbortError'
        ? `请求超时（${timeoutMs}ms）`
        : err instanceof Error
          ? err.message
          : '未知网络错误';
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 探测 API liveness：GET {base}/health/live。
 * 返回 `ok` 或 `unreachable`（liveness 只有 ok 一种成功态）。
 */
export async function probeApiLiveness(
  baseUrl: string,
  timeoutMs = API_TIMEOUT_MS,
): Promise<ApiLivenessStatus> {
  const start = performance.now();
  const result = await fetchWithTimeout(`${baseUrl}/health/live`, timeoutMs);
  if (!result.ok) {
    return { name: 'api', status: 'unreachable', error: result.reason };
  }
  if (!result.res.ok) {
    return {
      name: 'api',
      status: 'unreachable',
      error: `HTTP ${result.res.status}`,
    };
  }
  try {
    const body = (await result.res.json()) as LiveResponse;
    // 契约保证 liveness 成功时 status === 'ok'
    if (body.status === 'ok') {
      return { name: 'api', status: 'ok', latencyMs: elapsedMs(start) };
    }
    return {
      name: 'api',
      status: 'unreachable',
      error: '响应状态非 ok',
    };
  } catch {
    return {
      name: 'api',
      status: 'unreachable',
      error: '响应体非合法 JSON',
    };
  }
}

/**
 * 探测依赖组件就绪情况：GET {base}/health/ready。
 * 从 checks 数组中按 name 提取指定组件状态；API 不可达时该组件标记 unreachable。
 */
export async function probeDependencies(
  baseUrl: string,
  names: readonly string[],
  timeoutMs = API_TIMEOUT_MS,
): Promise<Record<string, DependencyStatus>> {
  const result = await fetchWithTimeout(`${baseUrl}/health/ready`, timeoutMs);

  const build: Record<string, DependencyStatus> = {};
  for (const name of names) {
    build[name] = { name, status: 'unreachable', error: '依赖探测未完成' };
  }

  if (!result.ok) {
    for (const name of names) {
      build[name] = { name, status: 'unreachable', error: result.reason };
    }
    return build;
  }
  if (!result.res.ok) {
    for (const name of names) {
      build[name] = {
        name,
        status: 'unreachable',
        error: `HTTP ${result.res.status}`,
      };
    }
    return build;
  }

  let body: ReadyResponse;
  try {
    body = (await result.res.json()) as ReadyResponse;
  } catch {
    for (const name of names) {
      build[name] = {
        name,
        status: 'unreachable',
        error: '响应体非合法 JSON',
      };
    }
    return build;
  }

  const byName = new Map<string, ComponentStatus>();
  for (const check of body.checks ?? []) {
    byName.set(check.name, check);
  }

  for (const name of names) {
    const check = byName.get(name);
    if (!check) {
      build[name] = {
        name,
        status: 'unreachable',
        error: 'API 未报告该组件',
      };
      continue;
    }
    build[name] = {
      name,
      status: check.status,
      latencyMs: check.latencyMs,
      error: check.error,
    };
  }
  return build;
}

/**
 * 聚合各探测项为整体状态：
 * - 任一 unreachable 或 down → down
 * - 任一 degraded → degraded
 * - 否则 ok
 */
export function aggregateOverall(statuses: ProbeStatus[]): ComponentStatusValue {
  if (statuses.some((s) => s === 'unreachable' || s === 'down')) {
    return 'down';
  }
  if (statuses.some((s) => s === 'degraded')) {
    return 'degraded';
  }
  return 'ok';
}
