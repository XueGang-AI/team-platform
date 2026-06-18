import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { RedisService } from '../../src/redis/redis.service';

/**
 * 依赖失败场景：用一个指向关闭端口的真实 RedisService 覆盖默认 provider，验证：
 * - live 仍 200（进程存活，不受依赖影响）
 * - ready 返回未就绪（503），redis 标记 down，postgres 仍 ok
 * - API 进程不崩溃
 * - 响应不泄露密码/连接串/堆栈
 *
 * 用 overrideProvider 注入真实坏连接实例，而非 mock，以保证失败路径真实。
 */
describe('Dependency failure (redis down)', () => {
  let app: INestApplication;
  let badRedis: RedisService;

  beforeAll(async () => {
    // 构造一个指向关闭端口的真实 RedisService（仅读取 REDIS_URL）
    const badConfig = {
      get: (key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6390' : undefined),
    } as unknown as ConfigService;
    badRedis = new RedisService(badConfig);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue(badRedis)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health/live → 200 even when redis is down', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready → 503 with redis down and overall down', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('down');
    const redisCheck = res.body.checks.find((c: { name: string }) => c.name === 'redis');
    expect(redisCheck?.status).toBe('down');
    const pgCheck = res.body.checks.find((c: { name: string }) => c.name === 'postgres');
    expect(pgCheck?.status).toBe('ok');
  });

  it('failure response does not leak sensitive info', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/team_platform/);
    expect(body).not.toMatch(/redis:\/\//);
    expect(body).not.toMatch(/6390/);
    expect(body).not.toMatch(/password|secret|token/i);
  });
});
