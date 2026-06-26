/// <reference types="jest" />
/**
 * 首页 Server Component 渲染测试。
 *
 * page.tsx 在服务端调用 getWebEnv() 读取环境变量，因此测试需先设置 process.env。
 * 验证：项目名称、当前阶段、环境标识、管理后台核心区域。
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

  it('显示当前阶段标识', () => {
    expect(markup).toContain('Phase 6-12');
    expect(markup).toContain('治理中枢本地完整闭环');
  });

  it('显示当前环境标识（来自环境变量）', () => {
    expect(markup).toContain('环境：');
    expect(markup).toContain('dev');
  });

  it('包含项目服务目录与系统状态区域', () => {
    expect(markup).toContain('项目服务目录');
    expect(markup).toContain('平台基础设施');
  });

  it('包含多阶段治理入口', () => {
    expect(markup).toContain('Manifest 接入');
    expect(markup).toContain('新建项目');
  });

  it('使用语义化主区域与标题层级', () => {
    expect(markup).toContain('<main');
    expect(markup).toContain('<h1');
    expect(markup).toContain('id="main"');
  });
});
