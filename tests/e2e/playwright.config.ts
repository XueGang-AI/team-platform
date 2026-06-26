import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.E2E_WEB_PORT ?? '3000';
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${webPort}`;

/**
 * team-platform E2E 配置（Phase 1）
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 前置条件（由主 Agent 统一编排，本配置不负责启动基础设施与 API）：
 *   1. docker compose up -d            → PostgreSQL :5433 + Redis :6380（宿主端口，避开本机冲突）
 *   2. pnpm --filter @team-platform/api start   → API :3001（需 DATABASE_URL / REDIS_URL）
 *   3. pnpm --filter @team-platform/web start   → Web :3000（需先 `pnpm --filter @team-platform/web build`）
 *   4. pnpm --filter @team-platform/e2e exec playwright install chromium
 *
 * 如 3000 已被被接入项目占用，可设置 E2E_WEB_PORT=3004。
 *
 * webServer 策略：
 *   - reuseExistingServer: true：主 Agent 已启动 Web 时，Playwright 仅做 URL 探测，不重复启动。
 *   - command 仅作 fallback：当 Web 未运行时尝试启动 Web（不负责 API 与基础设施）。
 *   - 不在此处启动 API / docker compose，避免环境变量缺失与端口冲突。
 *   - 若 fallback 启动 Web 但 API 不可达，首页组件状态将降级，
 *     「浏览器控制台无错误」用例可能失败（符合「服务未就绪则测试失败」预期）。
 * ───────────────────────────────────────────────────────────────────────────
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: `pnpm --filter @team-platform/web exec next start -p ${webPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
