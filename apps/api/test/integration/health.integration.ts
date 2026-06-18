import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * 集成测试：真实 PostgreSQL + Redis。
 * 前置：本地 `pnpm dev:infra` 或 CI service containers 已提供 PG(:5432)/Redis(:6379)。
 * 环境变量由 test/integration/setup.ts 在模块加载前预设。
 */
describe('Health & version integration (real PG + Redis)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health/live → 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health/ready → 200 with postgres and redis ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const names = res.body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain('postgres');
    expect(names).toContain('redis');
    expect(res.body.checks.every((c: { status: string }) => c.status === 'ok')).toBe(true);
  });

  it('GET /version → 200 with name/version/environment/node', async () => {
    const res = await request(app.getHttpServer()).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.name).toBeDefined();
    expect(res.body.version).toBeDefined();
    expect(res.body.environment).toBeDefined();
    expect(res.body.node).toMatch(/^v/);
  });

  it('responses do not leak sensitive connection info', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/team_platform:team_platform/);
    expect(body).not.toMatch(/postgresql:\/\//);
    expect(body).not.toMatch(/redis:\/\//);
  });

  it('echoes inbound x-request-id and generates one when absent', async () => {
    const withHeader = await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'my-trace-id');
    expect(withHeader.headers['x-request-id']).toBe('my-trace-id');

    const withoutHeader = await request(app.getHttpServer()).get('/health/live');
    expect(withoutHeader.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('unknown route → 404 ErrorResponse', async () => {
    const res = await request(app.getHttpServer()).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
