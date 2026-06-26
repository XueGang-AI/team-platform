import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * 管理后台首页 E2E
 *
 * 断言依据：已冻结契约（packages/contracts/src/index.ts）与首页展示约定：
 *   - 项目名 team-platform、当前阶段
 *   - Web / API / PostgreSQL / Redis 各组件状态
 *   - 登录、项目服务目录、Manifest 接入等核心入口
 *
 * 测试不 mock 真实服务，依赖 Web（默认 :3000，可用 E2E_WEB_PORT 覆盖）+
 * API(:3001) + Postgres + Redis。
 */

/** 组件状态值文本（覆盖契约的 ok/degraded/down 及可能的中文渲染）。 */
const STATUS_VALUE_RE =
  /\b(ok|degraded|down)\b|正常|降级|不可用|异常|健康|不健康|就绪|未就绪|运行中|离线/i;

/** 等待首页主体渲染完成（异步获取状态，需给足时间）。 */
async function waitForHomeReady(page: Page): Promise<void> {
  await expect(page.getByText('team-platform', { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('管理后台首页 - 项目治理控制台', () => {
  test('首页可访问并展示项目与阶段信息', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response?.ok()).toBe(true);
    expect(response?.status()).toBe(200);

    await waitForHomeReady(page);

    await expect(page.getByText(/Phase\s*6-12/i).first()).toBeVisible();
    await expect(page.getByText('项目服务目录').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
    await expect(page.getByText('Manifest 接入')).toBeVisible();
  });

  test('展示各组件运行状态', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);

    const statusList = page.getByRole('list', { name: '组件状态列表' });

    // 组件状态标签可见
    await expect(statusList.getByText('管理后台 (Web)', { exact: true })).toBeVisible();
    await expect(statusList.getByText('平台 API', { exact: true })).toBeVisible();
    await expect(statusList.getByText('PostgreSQL', { exact: true })).toBeVisible();
    await expect(statusList.getByText('Redis', { exact: true })).toBeVisible();

    // 状态值已渲染（页面异步拉取 /health/ready 后回填，需等待）
    await expect
      .poll(
        async () => {
          const text = (await page.locator('body').textContent()) ?? '';
          return STATUS_VALUE_RE.test(text);
        },
        { timeout: 20_000, message: '页面应展示至少一个组件状态值（ok/degraded/down 等）' },
      )
      .toBe(true);
  });

  test('浏览器控制台无错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // 必须在导航前注册，以捕获加载期间的错误
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err: Error) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    await waitForHomeReady(page);
    await page.waitForLoadState('networkidle');

    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) => !/Failed to load resource: net::ERR_CONNECTION_REFUSED/.test(message),
    );
    expect(unexpectedConsoleErrors, `控制台错误:\n${unexpectedConsoleErrors.join('\n')}`).toEqual(
      [],
    );
    expect(pageErrors, `页面未捕获异常:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('桌面视口无横向溢出', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);
    await page.waitForLoadState('networkidle');

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    // 1px 容差用于亚像素渲染
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });
});
