/// <reference types="jest" />
/**
 * 首页 Server Component 渲染测试。
 *
 * page.tsx 在服务端调用 getWebEnv() 读取环境变量，因此测试需先设置 process.env。
 * 验证：项目名称、Phase 1 阶段、环境标识、Phase 2 说明、无虚假业务数据。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '@/app/page';

const ENV_KEYS = ['ENVIRONMENT', 'LOG_LEVEL', 'WEB_PORT', 'WEB_API_BASE_URL'];

beforeEach(() => {
  // webEnvSchema 各字段均有默认值；这里显式设置非 NODE_ENV 字段以固定测试断言。
  // NODE_ENV 在 @types/node 中为只读，且 schema 已有默认值，故不赋值。
  process.env.ENVIRONMENT = 'dev';
  process.env.LOG_LEVEL = 'info';
  process.env.WEB_PORT = '3000';
  process.env.WEB_API_BASE_URL = 'http://localhost:3001';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe('HomePage 首页渲染', () => {
  const markup = renderToStaticMarkup(<HomePage />);

  it('显示项目名称 team-platform', () => {
    expect(markup).toContain('team-platform');
  });

  it('显示 Phase 1 阶段标识', () => {
    expect(markup).toContain('Phase 1');
    expect(markup).toContain('工程骨架与本地基础设施');
  });

  it('显示当前环境标识（来自环境变量）', () => {
    expect(markup).toContain('环境：');
    expect(markup).toContain('dev');
  });

  it('包含 Phase 2 说明文案', () => {
    expect(markup).toContain('项目治理业务将在 Phase 2 开始实现');
    expect(markup).toContain('无业务数据');
  });

  it('不包含任何虚假业务数据', () => {
    expect(markup).not.toMatch(/项目数|用户数|告警数|成本|图表|趋势|统计|Dashboard/);
  });

  it('使用语义化主区域与标题层级', () => {
    expect(markup).toContain('<main');
    expect(markup).toContain('<h1');
    expect(markup).toContain('id="main"');
  });
});
