import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * 管理后台首页 E2E（Phase 1）
 *
 * 断言依据：已冻结契约（packages/contracts/src/index.ts）与首页展示约定：
 *   - 项目名 team-platform、阶段 Phase 1
 *   - Web / API / PostgreSQL / Redis 各组件状态
 *   - 「项目治理业务将在 Phase 2 开始实现」说明文案
 *
 * 测试不 mock 真实服务，依赖主 Agent 启动 Web(:3000) + API(:3001) + Postgres + Redis。
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

test.describe('管理后台首页 - Phase 1 状态看板', () => {
  test('首页可访问并展示项目与阶段信息', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response?.ok()).toBe(true);
    expect(response?.status()).toBe(200);

    await waitForHomeReady(page);

    // 项目名与阶段标识
    await expect(page.getByText(/Phase\s*1/i).first()).toBeVisible();
    // Phase 2 业务说明文案
    await expect(page.getByText(/Phase\s*2/i).first()).toBeVisible();
  });

  test('展示各组件运行状态', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);

    // 组件状态标签可见
    await expect(page.getByText('Web', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('API', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('PostgreSQL', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Redis', { exact: false }).first()).toBeVisible();

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

    expect(consoleErrors, `控制台错误:\n${consoleErrors.join('\n')}`).toEqual([]);
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
