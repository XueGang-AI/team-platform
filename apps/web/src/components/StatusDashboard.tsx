'use client';

import { useEffect, useState } from 'react';
import {
  aggregateOverall,
  probeApiLiveness,
  probeDependencies,
  type ApiLivenessStatus,
  type DependencyStatus,
  type DashboardStatus,
} from '@/lib/api-health';
import { StatusBadge, overallSummary } from '@/components/StatusBadge';

const DEPENDENCY_NAMES = ['postgres', 'redis'] as const;

/** 客户端初始 loading 态。 */
function initialStatus(): DashboardStatus {
  return {
    web: { name: 'web', status: 'ok' },
    api: { name: 'api', status: 'loading' },
    postgres: {
      name: 'postgres',
      status: 'loading',
    },
    redis: { name: 'redis', status: 'loading' },
    overall: 'down',
    fetchedAt: '',
  };
}

interface StatusDashboardProps {
  /** 已解析的 API 基础地址，由 Server Component 传入。 */
  apiBaseUrl: string;
}

/**
 * 状态仪表盘：Client Component。
 *
 * - 由 Server Component 注入 apiBaseUrl，不直接读取环境变量，避免内部地址进入客户端 bundle 之外。
 * - 挂载后并发探测 /health/live 与 /health/ready，带 4s 超时。
 * - API 不可达时各依赖项显示降级状态，页面不崩溃。
 * - 提供「刷新」按钮，可手动重新探测（不自动轮询，避免本地开发噪音）。
 */
export function StatusDashboard({ apiBaseUrl }: StatusDashboardProps) {
  const [status, setStatus] = useState<DashboardStatus>(initialStatus);
  const [refreshing, setRefreshing] = useState(false);

  async function runProbe() {
    setRefreshing(true);
    // 先标记为 loading，让用户感知到正在重新检测
    setStatus((prev) => ({
      ...prev,
      api: { ...prev.api, status: 'loading', error: undefined, latencyMs: undefined },
      postgres: { ...prev.postgres, status: 'loading', error: undefined },
      redis: { ...prev.redis, status: 'loading', error: undefined },
    }));

    const [apiStatus, deps] = await Promise.all([
      probeApiLiveness(apiBaseUrl),
      probeDependencies(apiBaseUrl, DEPENDENCY_NAMES),
    ]);

    const postgres = deps['postgres'] as DependencyStatus;
    const redis = deps['redis'] as DependencyStatus;
    const overall = aggregateOverall([apiStatus.status, postgres.status, redis.status]);

    setStatus({
      web: { name: 'web', status: 'ok' },
      api: apiStatus as ApiLivenessStatus,
      postgres,
      redis,
      overall,
      fetchedAt: new Date().toISOString(),
    });
    setRefreshing(false);
  }

  useEffect(() => {
    void runProbe();
    // 仅在挂载时执行首次探测；runProbe 内部读取 props/状态后自洽，无需重复触发。
    // 依赖数组保持为空以避免每次渲染重新探测。
  }, []);

  const summary = overallSummary(status.overall);

  return (
    <section aria-labelledby="overall-status-title" className="panel">
      <header className="panel-header">
        <h2 id="overall-status-title">{summary.title}</h2>
        <p className="panel-desc">{summary.description}</p>
      </header>

      <div className="overall-row">
        <StatusBadge status={status.overall} />
        {status.fetchedAt ? (
          <time dateTime={status.fetchedAt} className="fetched-at" title={status.fetchedAt}>
            检测时间 {new Date(status.fetchedAt).toLocaleTimeString('zh-CN')}
          </time>
        ) : null}
        <button
          type="button"
          onClick={() => void runProbe()}
          disabled={refreshing}
          className="refresh-btn"
        >
          {refreshing ? '检测中…' : '重新检测'}
        </button>
      </div>

      <ul className="status-list" aria-label="组件状态列表">
        <StatusRow
          label="管理后台 (Web)"
          name={status.web.name}
          status={status.web.status}
          hint="本页面自身"
        />
        <StatusRow
          label="平台 API"
          name={status.api.name}
          status={status.api.status}
          latencyMs={status.api.latencyMs}
          error={status.api.error}
          hint={`${apiBaseUrl}/health/live`}
        />
        <StatusRow
          label="PostgreSQL"
          name={status.postgres.name}
          status={status.postgres.status}
          latencyMs={status.postgres.latencyMs}
          error={status.postgres.error}
          hint="通过 API /health/ready 上报"
        />
        <StatusRow
          label="Redis"
          name={status.redis.name}
          status={status.redis.status}
          latencyMs={status.redis.latencyMs}
          error={status.redis.error}
          hint="通过 API /health/ready 上报"
        />
      </ul>

      <p className="phase-note">
        项目治理业务将在 Phase 2 开始实现。当前仅展示真实系统状态，无业务数据。
      </p>
    </section>
  );
}

interface StatusRowProps {
  label: string;
  name: string;
  status: ApiLivenessStatus['status'];
  latencyMs?: number;
  error?: string;
  hint?: string;
}

function StatusRow({ label, name, status, latencyMs, error, hint }: StatusRowProps) {
  return (
    <li className="status-row">
      <div className="status-row-main">
        <span className="status-label">{label}</span>
        <StatusBadge status={status} />
      </div>
      <div className="status-row-meta">
        {typeof latencyMs === 'number' ? <span className="latency">{latencyMs}ms</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <span className="sr-only">{name}</span>
    </li>
  );
}
