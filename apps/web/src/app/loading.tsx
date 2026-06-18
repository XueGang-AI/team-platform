/**
 * 路由级加载态。
 *
 * Server Component 在读取环境变量/初始化时，Next.js 用此文件作为流式占位。
 * 注意：组件真实状态的 loading 由 StatusDashboard 内部状态机承担，
 * 本文件仅覆盖首次服务端渲染前的瞬态。
 */
export default function Loading() {
  return (
    <main id="main" className="page">
      <header className="page-header">
        <h1>team-platform 管理后台</h1>
        <div className="meta">
          <span>正在加载…</span>
        </div>
      </header>
      <section className="panel" aria-busy="true" aria-live="polite">
        <header className="panel-header">
          <h2>正在检测平台状态</h2>
          <p className="panel-desc">请稍候，正在连接本地基础设施。</p>
        </header>
        <div className="overall-row">
          <span className="tone tone-loading" role="img" aria-label="检测中">
            <span aria-hidden="true" className="dot" />
            检测中
          </span>
        </div>
      </section>
    </main>
  );
}
