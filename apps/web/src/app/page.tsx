import { getWebEnv } from '@/lib/env';
import { StatusDashboard } from '@/components/StatusDashboard';

/**
 * 管理后台首页（Server Component）。
 *
 * Phase 1 仅展示真实系统状态，不含任何业务数据。
 * - 项目名称、当前阶段为静态事实，直接渲染。
 * - 组件状态由子组件 StatusDashboard（Client）通过 API 健康端点实时获取。
 * - WEB_API_BASE_URL 在服务端用 loadEnv(webEnvSchema) 校验后作为 prop 注入，
 *   客户端不读取 process.env，避免内部地址散落到浏览器 bundle 之外。
 *
 * 失败模式：环境变量校验失败时 Next.js 会渲染 error boundary（由 app/error.tsx 承载）。
 */
export default function HomePage() {
  const env = getWebEnv();

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
          <span>
            环境：<strong>{env.ENVIRONMENT}</strong>
          </span>
        </div>
      </header>

      <StatusDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
    </main>
  );
}
