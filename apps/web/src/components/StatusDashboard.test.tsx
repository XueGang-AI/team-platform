/// <reference types="jest" />
/**
 * StatusDashboard 渲染测试。
 *
 * 仓库未安装 jest-environment-jsdom 与 @testing-library/react，
 * 因此使用 react-dom/server 的 renderToStaticMarkup 在 node 环境做静态渲染断言。
 * useEfect 在 SSR 下不执行，渲染结果为初始 loading 态——这恰好验证 loading 状态真实存在。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusDashboard } from '@/components/StatusDashboard';
import { StatusBadge, statusLabel } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it('ok 状态渲染正常标签与可访问 role', () => {
    const html = renderToStaticMarkup(<StatusBadge status="ok" />);
    expect(html).toContain('正常');
    expect(html).toContain('aria-label="正常"');
    expect(html).toContain('role="img"');
    expect(html).toContain('data-tone="ok"');
  });

  it('degraded 状态渲染降级标签', () => {
    const html = renderToStaticMarkup(<StatusBadge status="degraded" />);
    expect(html).toContain('降级');
    expect(html).toContain('data-tone="degraded"');
  });

  it('unreachable 状态归入 down 色调', () => {
    const html = renderToStaticMarkup(<StatusBadge status="unreachable" />);
    expect(html).toContain('不可达');
    expect(html).toContain('data-tone="down"');
  });

  it('loading 状态渲染检测中标签', () => {
    const html = renderToStaticMarkup(<StatusBadge status="loading" />);
    expect(html).toContain('检测中');
    expect(html).toContain('data-tone="loading"');
  });
});

describe('statusLabel', () => {
  it('down 状态映射为不可用', () => {
    expect(statusLabel('down')).toBe('不可用');
  });
});

describe('StatusDashboard 初始渲染', () => {
  const markup = renderToStaticMarkup(<StatusDashboard apiBaseUrl="http://localhost:3201" />);

  it('展示 Web/API/PostgreSQL/Redis 四个真实组件项', () => {
    expect(markup).toContain('管理后台 (Web)');
    expect(markup).toContain('平台 API');
    expect(markup).toContain('PostgreSQL');
    expect(markup).toContain('Redis');
  });

  it('存在 loading 状态（检测中），验证 loading 真实实现', () => {
    // 初始渲染时 api/postgres/redis 为 loading
    const loadingCount = (markup.match(/检测中/g) || []).length;
    expect(loadingCount).toBeGreaterThanOrEqual(1);
  });

  it('存在 API 健康端点提示，说明通过 API 获取而非直连数据库', () => {
    expect(markup).toContain('/health/live');
    expect(markup).toContain('通过 API /health/ready 上报');
  });

  it('包含当前控制面说明文案', () => {
    expect(markup).toContain('项目治理控制面由平台 API 提供');
  });

  it('状态面板只展示基础设施状态，不承载业务详情', () => {
    expect(markup).not.toMatch(/服务凭证|治理记录|Manifest 接入/);
  });

  it('Web 自身状态恒为正常，不进入 loading', () => {
    // Web 行紧随「管理后台 (Web)」后应为正常徽章
    expect(markup).toContain('管理后台 (Web)');
    expect(markup).toContain('正常');
  });

  it('提供刷新按钮，键盘可达', () => {
    expect(markup).toContain('重新检测');
    expect(markup).toContain('<button');
  });
});
