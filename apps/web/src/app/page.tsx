import { getWebEnv } from '@/lib/env';
import { ProjectRegistryDashboard } from '@/components/ProjectRegistryDashboard';
import { StatusDashboard } from '@/components/StatusDashboard';

/**
 * 管理后台首页（Server Component）。
 *
 * 当前首页展示项目服务目录、权限治理入口与真实系统状态。
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
        <h1>团队项目治理平台</h1>
        <div className="meta">
          <span>
            项目名称：<strong>team-platform</strong>
          </span>
          <span>
            平台入口：<strong>项目目录 · 接入协议 · 权限凭证 · 治理中枢</strong>
          </span>
          <span>
            当前阶段：<strong>Phase 6-12 · 本地完整闭环</strong>
          </span>
          <span>
            环境：<strong>{env.ENVIRONMENT}</strong>
          </span>
        </div>
      </header>

      <nav className="platform-links" aria-label="平台入口">
        <a href="/api/platform/docs" target="_blank" rel="noreferrer">
          平台 API 文档
        </a>
        <a href="http://localhost:3002" target="_blank" rel="noreferrer">
          观测看板
        </a>
        <a href="http://localhost:9090" target="_blank" rel="noreferrer">
          指标查询
        </a>
        <a href="http://localhost:3100/ready" target="_blank" rel="noreferrer">
          日志组件
        </a>
      </nav>

      <ProjectRegistryDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
      <StatusDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
    </main>
  );
}
