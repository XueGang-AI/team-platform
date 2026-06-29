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
    <main id="main" className="app-shell">
      <aside className="app-sidebar" aria-label="平台导航">
        <div className="brand-block">
          <span className="brand-mark">TP</span>
          <div>
            <h1>团队项目治理平台</h1>
            <p>error</p>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Internal Developer Platform</p>
            <h2>项目治理工作台</h2>
          </div>
          <div className="meta">
            <span>
              项目：<strong>team-platform</strong>
            </span>
          </div>
        </header>
        <section className="panel" role="alert">
          <header className="panel-header">
            <h2>页面无法加载</h2>
            <p className="panel-desc">
              管理后台初始化失败。请检查 <code>.env</code> 中的 <code>WEB_API_BASE_URL</code>、{' '}
              <code>ENVIRONMENT</code> 等配置项后重试。
            </p>
          </header>
          <button type="button" onClick={reset} className="secondary-btn">
            重试
          </button>
        </section>
      </div>
    </main>
  );
}
