import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * 管理后台首页 E2E
 *
 * 断言依据：已冻结契约（packages/contracts/src/index.ts）与首页展示约定：
 *   - 项目名 team-platform、当前阶段
 *   - Web / API / PostgreSQL / Redis 各组件状态
 *   - 登录、项目服务目录、Manifest 接入等核心入口
 *
 * 测试不 mock 真实服务，依赖 Web（默认 :3200，可用 E2E_WEB_PORT 覆盖）+
 * API(:3201) + Postgres + Redis。
 */

/** 组件状态值文本（覆盖契约的 ok/degraded/down 及可能的中文渲染）。 */
const STATUS_VALUE_RE =
  /\b(ok|degraded|down)\b|正常|降级|不可用|异常|健康|不健康|就绪|未就绪|运行中|离线/i;

const DASHBOARD_HASHES = [
  'overview',
  'catalog',
  'services',
  'health',
  'governance',
  'release',
  'cost',
  'access',
  'integration',
  'observability',
] as const;

const COMPACT_WORKSPACE_HASHES = [
  'services',
  'health',
  'governance',
  'release',
  'cost',
  'access',
] as const;

const WORKSPACE_SELECTORS: Record<(typeof COMPACT_WORKSPACE_HASHES)[number], string> = {
  services: '.service-workbench',
  health: '.health-grid',
  governance: '.governance-board',
  release: '.release-board',
  cost: '.cost-board',
  access: '.access-board',
};

const MANJV_STUDIO_MANIFEST = `apiVersion: team-platform.io/v1alpha1
kind: Project

metadata:
  slug: manjv-studio
  name: Manjv Studio
  labels:
    domain: ai-video
    language: typescript
    runtime: nextjs

spec:
  type: AI_APPLICATION
  owner:
    name: XueGang-AI
    email: example@example.com
  repository:
    url: file:///Users/xuegang/Desktop/My%20Project/manjv-studio
  services:
    - slug: web
      name: Manjv Studio Web
      type: WEB
    - slug: api
      name: Manjv Studio API Routes
      type: API
    - slug: worker
      name: Manjv Studio Worker
      type: WORKER
    - slug: model-adapters
      name: Model Adapters
      type: MODEL_SERVICE
    - slug: task-events
      name: Task Events
      type: WORKER
  environments:
    - slug: local
      name: 本地开发
    - slug: docker
      name: Docker 演示
  endpoints:
    - service: web
      environment: local
      baseUrl: http://localhost:3100
      healthCheck:
        enabled: true
        path: /
    - service: api
      environment: local
      baseUrl: http://localhost:3100
      healthCheck:
        enabled: true
        path: /api/health
`;

/** 等待首页主体渲染完成（异步获取状态，需给足时间）。 */
async function waitForHomeReady(page: Page): Promise<void> {
  await expect(page.getByText('team-platform', { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function loginAsPlatformAdmin(page: Page): Promise<{ token: string; user: unknown }> {
  const response = await page.request.post('/api/platform/auth/login', {
    data: { email: 'admin@example.com', name: 'Admin' },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { token: string; user: unknown };
  const writeSession = ({ token, user }: { token: string; user: unknown }) => {
    window.localStorage.setItem('team-platform-token', token);
    window.localStorage.setItem('team-platform-user', JSON.stringify(user));
  };
  await page.addInitScript(writeSession, body);
  await page.goto('/');
  await page.evaluate(writeSession, body);
  return body;
}

async function ensureManjvStudioProject(page: Page, token: string): Promise<void> {
  const response = await page.request.post('/api/platform/project-manifests/apply', {
    data: { manifest: MANJV_STUDIO_MANIFEST },
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
}

async function readPlatformJson<T>(page: Page, path: string, token: string): Promise<T> {
  const response = await page.request.get(`/api/platform${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}

test.describe('管理后台首页 - 项目治理控制台', () => {
  test('首页可访问并展示项目与阶段信息', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response?.ok()).toBe(true);
    expect(response?.status()).toBe(200);

    await waitForHomeReady(page);

    await expect(page.getByText('项目治理工作台', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('服务健康矩阵').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
    await expect(page.getByText('接入').first()).toBeVisible();
  });

  test('展示各组件运行状态', async ({ page }) => {
    await page.goto('/#health');
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

  test('桌面滚动到底部后左侧导航持续覆盖视口', async ({ page }) => {
    await page.setViewportSize({ width: 1992, height: 1100 });

    for (const hash of DASHBOARD_HASHES) {
      await page.goto(`/#${hash}`);
      await waitForHomeReady(page);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(100);

      const coverage = await page.evaluate(() => {
        const sidebar = document.querySelector<HTMLElement>('.app-sidebar');
        const rect = sidebar?.getBoundingClientRect();
        const probe = document.elementFromPoint(12, window.innerHeight - 12);
        return {
          bottom: rect?.bottom ?? 0,
          top: rect?.top ?? 0,
          height: rect?.height ?? 0,
          viewportHeight: window.innerHeight,
          probeInSidebar: Boolean(probe?.closest('.app-sidebar')),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      expect(coverage.scrollWidth, `${hash} 不应产生横向溢出`).toBeLessThanOrEqual(
        coverage.innerWidth + 1,
      );
      expect(coverage.top, `${hash} 侧栏顶部应贴住视口`).toBeLessThanOrEqual(0);
      expect(coverage.bottom, `${hash} 侧栏底部应覆盖视口底部`).toBeGreaterThanOrEqual(
        coverage.viewportHeight,
      );
      expect(coverage.height, `${hash} 侧栏高度应至少等于视口高度`).toBeGreaterThanOrEqual(
        coverage.viewportHeight,
      );
      expect(coverage.probeInSidebar, `${hash} 左下角探针应命中侧栏`).toBe(true);
    }
  });

  test('平台 API 文档入口跳转真实 Swagger 页面', async ({ page }) => {
    await page.goto('/');
    await waitForHomeReady(page);

    await page.getByRole('link', { name: '平台 API 文档' }).click();
    await expect(page).toHaveURL(/\/api\/platform\/docs/);
    await expect(page).toHaveTitle(/Swagger UI/);
    await expect(page.locator('section.swagger-ui.swagger-container')).toBeVisible();
  });

  test('重点工作区桌面布局紧凑且无控件挤压', async ({ page }) => {
    await page.setViewportSize({ width: 1487, height: 1058 });
    const session = await loginAsPlatformAdmin(page);
    await ensureManjvStudioProject(page, session.token);

    for (const hash of COMPACT_WORKSPACE_HASHES) {
      await page.goto(`/#${hash}`);
      await waitForHomeReady(page);
      await page.waitForLoadState('networkidle');
      await page.locator(WORKSPACE_SELECTORS[hash]).waitFor({ state: 'visible' });

      const layout = await page.evaluate((currentHash) => {
        const rect = (selector: string) =>
          document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
        const viewportWidth = window.innerWidth;
        const sidebar = rect('.app-sidebar');
        const quickEntry = rect('.toolbar-icons a');
        const data: Record<string, number | boolean | null> = {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth,
          sidebarBottom: sidebar?.bottom ?? null,
          viewportHeight: window.innerHeight,
          quickEntryWidth: quickEntry?.width ?? null,
          quickEntryHeight: quickEntry?.height ?? null,
        };

        if (currentHash === 'services') {
          data.serviceWorkbenchHeight = rect('.service-workbench')?.height ?? null;
          data.serviceInspectorBottom = rect('.service-workbench .inspector-panel')?.bottom ?? null;
          data.serviceWorkbenchBottom = rect('.service-workbench')?.bottom ?? null;
        }
        if (currentHash === 'health') {
          const panel = document.querySelector<HTMLElement>('.system-health-panel');
          const statusList = document.querySelector<HTMLElement>(
            '.system-health-panel .status-list',
          );
          const panelRect = panel?.getBoundingClientRect();
          const rowRights = Array.from(
            document.querySelectorAll<HTMLElement>('.system-health-panel .status-row'),
          ).map((row) => row.getBoundingClientRect().right);
          data.systemHealthPanelRight = panelRect?.right ?? null;
          data.systemHealthListClientWidth = statusList?.clientWidth ?? null;
          data.systemHealthListScrollWidth = statusList?.scrollWidth ?? null;
          data.systemHealthMaxRowRight = rowRights.length ? Math.max(...rowRights) : null;
        }
        if (currentHash === 'governance') {
          data.governanceSideHeight = rect('.governance-side')?.height ?? null;
          data.governanceMainHeight = rect('.governance-main')?.height ?? null;
        }
        if (currentHash === 'release') {
          const listBottom = rect('.release-list')?.bottom ?? 0;
          const detailBottom = rect('.release-detail')?.bottom ?? 0;
          data.releaseGap =
            (rect('.release-quality')?.top ?? 0) - Math.max(listBottom, detailBottom);
        }
        if (currentHash === 'cost') {
          const trendBottom = rect('.cost-trend')?.bottom ?? 0;
          const distributionBottom = rect('.cost-distribution')?.bottom ?? 0;
          const sideBottom = rect('.cost-side')?.bottom ?? 0;
          data.costDetailGap =
            (rect('.cost-detail')?.top ?? 0) -
            Math.max(trendBottom, distributionBottom, sideBottom);
        }
        if (currentHash === 'access') {
          data.credentialInventoryHeight = rect('.credential-inventory')?.height ?? null;
          data.riskPanelHeight = rect('.risk-suggestion-panel')?.height ?? null;
        }
        return data;
      }, hash);

      expect(layout.scrollWidth, `${hash} 不应产生横向溢出`).toBeLessThanOrEqual(
        Number(layout.viewportWidth) + 1,
      );
      expect(layout.sidebarBottom, `${hash} 固定侧栏应覆盖视口底部`).toBeGreaterThanOrEqual(
        Number(layout.viewportHeight),
      );
      expect(layout.quickEntryWidth, `${hash} 快速入口不能被压成竖排`).toBeGreaterThanOrEqual(48);
      expect(
        layout.quickEntryHeight,
        `${hash} 快速入口高度应保持单行或正常按钮高度`,
      ).toBeLessThanOrEqual(42);

      if (hash === 'services') {
        expect(layout.serviceWorkbenchHeight).toBeLessThanOrEqual(760);
        expect(
          Number(layout.serviceWorkbenchBottom) - Number(layout.serviceInspectorBottom),
        ).toBeLessThanOrEqual(24);
      }
      if (hash === 'health') {
        expect(layout.systemHealthListScrollWidth).toBeLessThanOrEqual(
          Number(layout.systemHealthListClientWidth) + 1,
        );
        expect(layout.systemHealthMaxRowRight).toBeLessThanOrEqual(
          Number(layout.systemHealthPanelRight) + 1,
        );
      }
      if (hash === 'governance') {
        expect(layout.governanceSideHeight).toBeLessThanOrEqual(
          Number(layout.governanceMainHeight) + 80,
        );
      }
      if (hash === 'release') {
        expect(Math.abs(Number(layout.releaseGap))).toBeLessThanOrEqual(24);
      }
      if (hash === 'cost') {
        expect(Math.abs(Number(layout.costDetailGap))).toBeLessThanOrEqual(24);
      }
      if (hash === 'access') {
        expect(layout.credentialInventoryHeight).toBeLessThanOrEqual(300);
        expect(layout.riskPanelHeight).toBeLessThanOrEqual(260);
      }
    }
  });

  test('项目目录只展示真实 API 项目且无样例项目', async ({ page }) => {
    await page.setViewportSize({ width: 1487, height: 1058 });
    const session = await loginAsPlatformAdmin(page);
    await ensureManjvStudioProject(page, session.token);
    const projects = await readPlatformJson<{
      items: Array<{ name: string; slug: string }>;
      total: number;
      page: number;
      totalPages: number;
    }>(page, '/projects?page=1&pageSize=50&includeArchived=false', session.token);

    await page.goto('/#catalog');
    await waitForHomeReady(page);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(`共 ${projects.total} 个项目`)).toBeVisible();
    await expect(
      page.getByText(`共 ${projects.total} 条 · 第 ${projects.page}/${projects.totalPages} 页`),
    ).toBeVisible();
    await expect(page.locator('.project-table .project-row')).toHaveCount(projects.items.length);
    const projectRows = page.locator('.project-table .project-row');
    for (const project of projects.items) {
      const row = projectRows.filter({ hasText: project.slug });
      await expect(row, `项目目录应显示真实项目 ${project.slug}`).toHaveCount(1);
      await expect(row.getByText(project.name, { exact: true })).toBeVisible();
      await expect(row.getByText(project.slug, { exact: true })).toBeVisible();
    }

    await expect(page.getByText('DataInsight')).toHaveCount(0);
    await expect(page.getByText('Billing Service')).toHaveCount(0);
    await expect(page.getByText('共 28 条')).toHaveCount(0);
    await expect(page.locator('.project-table')).not.toContainText('docker-demo');
    await expect(page.getByRole('button', { name: '卡片视图' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '筛选已同步' })).toBeDisabled();
  });

  test('治理发布成本观测为空时不显示硬编码演示数据', async ({ page }) => {
    await page.setViewportSize({ width: 1487, height: 1058 });
    const session = await loginAsPlatformAdmin(page);
    await ensureManjvStudioProject(page, session.token);
    const governance = await readPlatformJson<{
      alerts: unknown[];
      deployments: unknown[];
      costRecords: unknown[];
      configurations: unknown[];
      tasks: unknown[];
      modelRoutes: unknown[];
    }>(page, '/projects/manjv-studio/governance-dashboard', session.token);

    await expect(governance.alerts.length).toBe(0);
    await expect(governance.deployments.length).toBe(0);
    await expect(governance.costRecords.length).toBe(0);

    const forbiddenTexts = [
      'DataInsight',
      'Billing Service',
      '支付服务',
      '订单服务',
      '库存服务',
      'v1.3.0',
      'v1.2.3',
      '失败率 6.25%',
      '发布频率 1.6 次/天',
      '¥10,000.00',
      '本地模型调用预算归因',
      '对象存储清理建议',
      'Grafana',
      'Prometheus',
      'Loki',
      'Tempo HTTP',
    ];

    for (const hash of ['overview', 'governance', 'release', 'cost', 'observability'] as const) {
      await page.goto(`/#${hash}`);
      await waitForHomeReady(page);
      await page.waitForLoadState('networkidle');
      for (const text of forbiddenTexts) {
        await expect(
          page.getByText(text, { exact: false }),
          `${hash} 不应显示 ${text}`,
        ).toHaveCount(0);
      }
    }

    await page.goto('/#governance');
    await waitForHomeReady(page);
    await expect(page.getByText('当前告警 暂无真实记录')).toBeVisible();
    await page.goto('/#release');
    await waitForHomeReady(page);
    await expect(page.getByText('全部环境 暂无真实发布记录')).toBeVisible();
    await page.goto('/#cost');
    await waitForHomeReady(page);
    await expect(page.getByText('暂无真实成本记录').first()).toBeVisible();
    await page.goto('/#observability');
    await waitForHomeReady(page);
    await expect(page.getByText('暂无项目观测链接').first()).toBeVisible();
  });

  test('未接入控件禁用，真实控件有反馈', async ({ page }) => {
    await page.setViewportSize({ width: 1487, height: 1058 });
    const session = await loginAsPlatformAdmin(page);
    await ensureManjvStudioProject(page, session.token);

    await page.goto('/#cost');
    await waitForHomeReady(page);
    await expect(page.getByRole('button', { name: '导出' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '配置预算' })).toBeDisabled();
    await expect(page.getByLabel('成本搜索暂未接入')).toBeDisabled();

    await page.goto('/#release');
    await waitForHomeReady(page);
    await expect(page.getByRole('button', { name: '同步 Git' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '回滚' })).toBeDisabled();
    await expect(page.getByLabel('发布搜索暂未接入')).toBeDisabled();

    await page.goto('/#services');
    await waitForHomeReady(page);
    const serviceSearch = page.getByLabel('搜索工作区');
    await expect(serviceSearch).toBeEnabled();
    await serviceSearch.fill('api');
    const filteredService = page
      .locator('.explorer-panel .explorer-item')
      .filter({ hasText: 'Manjv Studio API Routes' });
    await expect(filteredService).toHaveCount(1);
    await expect(
      filteredService.getByText('Manjv Studio API Routes', { exact: true }),
    ).toBeVisible();

    await page.goto('/#access');
    await waitForHomeReady(page);
    await page.getByRole('button', { name: '新增凭证' }).click();
    await expect(page.getByLabel('凭证名称')).toBeVisible();

    await expect(page.getByLabel('全局搜索暂未接入')).toBeDisabled();
    await expect(page.getByLabel('当前项目')).toBeDisabled();
    await expect(page.getByLabel('当前环境')).toBeDisabled();
  });

  test('390px 移动端项目目录主内容可读且关键容器不越界', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/#catalog');
    await waitForHomeReady(page);
    await page.waitForLoadState('networkidle');

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const main = document.querySelector<HTMLElement>('.app-main')?.getBoundingClientRect();
      const header = document
        .querySelector<HTMLElement>('.workspace-header')
        ?.getBoundingClientRect();
      const catalog = document
        .querySelector<HTMLElement>('.catalog-list-panel')
        ?.getBoundingClientRect();
      const firstRow = document
        .querySelector<HTMLElement>('.project-table .project-row')
        ?.getBoundingClientRect();
      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        mainWidth: main?.width ?? 0,
        headerRight: header?.right ?? 0,
        catalogRight: catalog?.right ?? 0,
        firstRowRight: firstRow?.right ?? 0,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.mainWidth).toBeGreaterThanOrEqual(360);
    expect(layout.headerRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.catalogRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.firstRowRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    await expect(page.getByText('项目目录').first()).toBeVisible();
    await expect(page.getByPlaceholder('搜索项目、负责人、标签')).toBeVisible();
  });
});
