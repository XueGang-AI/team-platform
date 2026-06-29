/// <reference types="jest" />
/**
 * api-health.ts 单元测试。
 *
 * 用 mock global.fetch 模拟契约结构响应，验证：
 * - API 正常时返回真实状态
 * - API 不可用时降级，不抛异常
 * - 依赖组件按 name 提取，缺失项标记 unreachable
 * - aggregateOverall 聚合逻辑正确
 */
import type { LiveResponse, ReadyResponse } from '@team-platform/contracts';
import {
  probeApiLiveness,
  probeDependencies,
  aggregateOverall,
  type ProbeStatus,
} from '@/lib/api-health';

// jest 在 node 环境下需要手动声明全局 fetch 与 AbortController
const originalFetch = global.fetch;

function mockFetchOk(body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response);
}

function mockFetchStatus(status: number): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('probeApiLiveness', () => {
  it('API 正常时返回 ok 与 latencyMs', async () => {
    const live: LiveResponse = { status: 'ok', timestamp: '2026-06-17T00:00:00Z' };
    global.fetch = mockFetchOk(live) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.name).toBe('api');
    expect(result.status).toBe('ok');
    expect(typeof result.latencyMs).toBe('number');
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3201/health/live',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('HTTP 非 2xx 时标记 unreachable', async () => {
    global.fetch = mockFetchStatus(503) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.status).toBe('unreachable');
    expect(result.error).toContain('503');
  });

  it('响应体非合法 JSON 时标记 unreachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.status).toBe('unreachable');
    expect(result.error).toContain('JSON');
  });

  it('响应 status 非 ok 时标记 unreachable', async () => {
    global.fetch = mockFetchOk({ status: 'down' }) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.status).toBe('unreachable');
  });

  it('网络错误（超时）时标记 unreachable 且不抛异常', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    global.fetch = jest.fn().mockImplementation(() => {
      // 模拟 AbortController.abort 触发的拒绝
      return Promise.reject(abortError);
    }) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.status).toBe('unreachable');
    expect(result.error).toContain('超时');
  });

  it('普通网络错误时标记 unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

    const result = await probeApiLiveness('http://localhost:3201');

    expect(result.status).toBe('unreachable');
    expect(result.error).toBe('fetch failed');
  });
});

describe('probeDependencies', () => {
  it('正常返回时按 name 提取 postgres / redis 状态', async () => {
    const ready: ReadyResponse = {
      status: 'ok',
      timestamp: '2026-06-17T00:00:00Z',
      checks: [
        { name: 'postgres', status: 'ok', latencyMs: 12 },
        { name: 'redis', status: 'ok', latencyMs: 3 },
      ],
    };
    global.fetch = mockFetchOk(ready) as unknown as typeof fetch;

    const deps = await probeDependencies('http://localhost:3201', ['postgres', 'redis']);

    expect(deps.postgres.status).toBe('ok');
    expect(deps.postgres.latencyMs).toBe(12);
    expect(deps.redis.status).toBe('ok');
    expect(deps.redis.latencyMs).toBe(3);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3201/health/ready',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('依赖降级时透传 degraded 状态', async () => {
    const ready: ReadyResponse = {
      status: 'degraded',
      timestamp: '2026-06-17T00:00:00Z',
      checks: [
        { name: 'postgres', status: 'ok', latencyMs: 12 },
        { name: 'redis', status: 'degraded', error: '连接池接近上限' },
      ],
    };
    global.fetch = mockFetchOk(ready) as unknown as typeof fetch;

    const deps = await probeDependencies('http://localhost:3201', ['postgres', 'redis']);

    expect(deps.postgres.status).toBe('ok');
    expect(deps.redis.status).toBe('degraded');
    expect(deps.redis.error).toBe('连接池接近上限');
  });

  it('API 不可达时所有依赖标记 unreachable', async () => {
    global.fetch = mockFetchStatus(500) as unknown as typeof fetch;

    const deps = await probeDependencies('http://localhost:3201', ['postgres', 'redis']);

    expect(deps.postgres.status).toBe('unreachable');
    expect(deps.postgres.error).toContain('500');
    expect(deps.redis.status).toBe('unreachable');
  });

  it('checks 中缺失某组件时该组件标记 unreachable', async () => {
    const ready: ReadyResponse = {
      status: 'ok',
      timestamp: '2026-06-17T00:00:00Z',
      checks: [{ name: 'postgres', status: 'ok', latencyMs: 12 }],
    };
    global.fetch = mockFetchOk(ready) as unknown as typeof fetch;

    const deps = await probeDependencies('http://localhost:3201', ['postgres', 'redis']);

    expect(deps.postgres.status).toBe('ok');
    expect(deps.redis.status).toBe('unreachable');
    expect(deps.redis.error).toContain('未报告');
  });

  it('网络错误时所有依赖标记 unreachable 且不抛异常', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

    const deps = await probeDependencies('http://localhost:3201', ['postgres', 'redis']);

    expect(deps.postgres.status).toBe('unreachable');
    expect(deps.redis.status).toBe('unreachable');
    expect(deps.postgres.error).toBe('fetch failed');
  });
});

describe('aggregateOverall', () => {
  it('全部 ok 时为 ok', () => {
    expect(aggregateOverall(['ok' as ProbeStatus, 'ok', 'ok'])).toBe('ok');
  });

  it('存在 degraded 时为 degraded', () => {
    expect(aggregateOverall(['ok', 'degraded', 'ok'])).toBe('degraded');
  });

  it('存在 down 时为 down', () => {
    expect(aggregateOverall(['ok', 'down', 'degraded'])).toBe('down');
  });

  it('存在 unreachable 时为 down', () => {
    expect(aggregateOverall(['ok', 'unreachable', 'ok'])).toBe('down');
  });

  it('down 优先级高于 degraded', () => {
    expect(aggregateOverall(['degraded', 'down'])).toBe('down');
  });
});
