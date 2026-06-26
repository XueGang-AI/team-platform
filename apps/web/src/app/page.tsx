import { getWebEnv } from '@/lib/env';
import { ProjectRegistryDashboard } from '@/components/ProjectRegistryDashboard';
import { StatusDashboard } from '@/components/StatusDashboard';
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  ClipboardList,
  Gauge,
  KeyRound,
  Rocket,
  Server,
  WalletCards,
} from 'lucide-react';

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
    <main id="main" className="app-shell">
      <aside className="app-sidebar" aria-label="平台导航">
        <div className="brand-block">
          <span className="brand-mark">TP</span>
          <div>
            <h1>团队项目治理平台</h1>
            <p>{env.ENVIRONMENT}</p>
          </div>
        </div>
        <nav className="side-nav">
          <a href="#overview">
            <Gauge aria-hidden="true" />
            总览
          </a>
          <a href="#catalog">
            <Boxes aria-hidden="true" />
            项目目录
          </a>
          <a href="#services">
            <Server aria-hidden="true" />
            服务与环境
          </a>
          <a href="#health">
            <Activity aria-hidden="true" />
            健康状态
          </a>
          <a href="#governance">
            <Bell aria-hidden="true" />
            告警治理
          </a>
          <a href="#release">
            <Rocket aria-hidden="true" />
            发布记录
          </a>
          <a href="#cost">
            <WalletCards aria-hidden="true" />
            成本
          </a>
          <a href="#access">
            <KeyRound aria-hidden="true" />
            权限凭证
          </a>
          <a href="#integration">
            <ClipboardList aria-hidden="true" />
            接入
          </a>
        </nav>
        <div className="sidebar-links">
          <a href="/api/platform/docs" target="_blank" rel="noreferrer">
            <BookOpen aria-hidden="true" />
            平台 API 文档
          </a>
          <a href="http://localhost:3002" target="_blank" rel="noreferrer">
            <Activity aria-hidden="true" />
            观测看板
          </a>
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
            <span>
              阶段：<strong>Phase 6-12 · 本地完整闭环</strong>
            </span>
          </div>
        </header>

        <ProjectRegistryDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
        <StatusDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
      </div>
    </main>
  );
}
