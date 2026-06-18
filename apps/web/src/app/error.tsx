'use client';

import { useEffect } from 'react';

/**
 * 路由级错误边界。
 *
 * 主要覆盖场景：服务端 getWebEnv() 校验失败（环境变量缺失/非法）。
 * 不打印敏感信息，仅提示用户检查环境变量配置。
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅记录错误名与 digest，不输出完整 message（可能含环境变量字段名）。
    console.error('HomePage 渲染失败:', error.name, error.digest ?? 'no-digest');
  }, [error]);

  return (
    <main id="main" className="page">
      <header className="page-header">
        <h1>team-platform 管理后台</h1>
        <div className="meta">
          <span>
            项目名称：<strong>team-platform</strong>
          </span>
          <span>
            当前阶段：<strong>Phase 1 · 工程骨架与本地基础设施</strong>
          </span>
        </div>
      </header>
      <section className="panel" role="alert">
        <header className="panel-header">
          <h2>页面无法加载</h2>
          <p className="panel-desc">
            管理后台初始化失败。常见原因：环境变量缺失或非法。 请检查 <code>.env</code> 中的{' '}
            <code>WEB_API_BASE_URL</code>、<code>ENVIRONMENT</code> 等配置项后重试。
          </p>
        </header>
        <button type="button" onClick={reset} className="refresh-btn">
          重试
        </button>
      </section>
    </main>
  );
}
