import { getWebEnv } from '@/lib/env';
import { ProjectRegistryDashboard } from '@/components/ProjectRegistryDashboard';
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  ClipboardList,
  Circle,
  CircleHelp,
  CircleUserRound,
  Gauge,
  KeyRound,
  Rocket,
  Search,
  Server,
  Settings,
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
            <h1>team-platform</h1>
            <p>由邹开发 Admin</p>
          </div>
          <span className="sidebar-collapse" aria-hidden="true">
            «
          </span>
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
          <a href="/api/platform/docs">
            <BookOpen aria-hidden="true" />
            平台 API 文档
          </a>
          <a href="#observability">
            <Activity aria-hidden="true" />
            观测看板
          </a>
        </div>
        <div className="sidebar-foot">
          <div className="sidebar-foot-icons" aria-label="快捷工具">
            <Bell aria-hidden="true" />
            <BookOpen aria-hidden="true" />
            <Activity aria-hidden="true" />
            <Settings aria-hidden="true" />
          </div>
          <div className="sidebar-user">
            <span>PA</span>
            <div>
              <strong>平台管理员</strong>
              <small>Platform Admin</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="top-toolbar" aria-label="全局工具栏">
          <label className="global-search">
            <Search aria-hidden="true" />
            <input
              placeholder="全局搜索暂未接入"
              aria-label="全局搜索暂未接入"
              disabled
              title="请在项目目录内使用真实项目搜索"
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="top-selectors">
            <label>
              项目
              <select
                aria-label="当前项目"
                defaultValue="manjv-studio"
                disabled
                title="当前项目由工作台真实项目选择决定"
              >
                <option value="manjv-studio">Manjv Studio</option>
              </select>
            </label>
            <label>
              环境
              <select
                aria-label="当前环境"
                defaultValue="local"
                disabled
                title="当前环境来自项目详情"
              >
                <option value="local">本地开发</option>
              </select>
            </label>
            <span className="env-dot">
              <Circle aria-hidden="true" />
              {env.ENVIRONMENT}
            </span>
          </div>
          <div className="toolbar-icons" aria-label="全局操作">
            <a href="#integration">快速入口</a>
            <CircleHelp aria-hidden="true" />
            <Settings aria-hidden="true" />
            <span className="toolbar-avatar">
              <CircleUserRound aria-hidden="true" />
              PA
              <ChevronDown aria-hidden="true" />
            </span>
          </div>
        </header>

        <ProjectRegistryDashboard apiBaseUrl={env.WEB_API_BASE_URL} />
      </div>
    </main>
  );
}
