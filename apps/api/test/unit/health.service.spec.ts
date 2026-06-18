import { HealthService } from '../../src/health/health.service';

describe('HealthService', () => {
  describe('live', () => {
    it('returns ok status with timestamp', () => {
      const service = new HealthService({} as never, {} as never);
      const result = service.live();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });
  });

  describe('checkReady', () => {
    it('returns ok when both deps healthy', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
      const redis = { ping: jest.fn().mockResolvedValue(true) };
      const service = new HealthService(prisma as never, redis as never);
      const result = await service.checkReady();
      expect(result.status).toBe('ok');
      expect(result.checks).toHaveLength(2);
      expect(result.checks.map((c) => c.name).sort()).toEqual(['postgres', 'redis']);
    });

    it('returns down when redis fails, without leaking error message', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) };
      const redis = { ping: jest.fn().mockRejectedValue(new Error('secret-connection-detail')) };
      const service = new HealthService(prisma as never, redis as never);
      const result = await service.checkReady();
      expect(result.status).toBe('down');
      const redisCheck = result.checks.find((c) => c.name === 'redis');
      expect(redisCheck?.status).toBe('down');
      // 仅暴露非敏感错误码，不泄露 message
      expect(JSON.stringify(result)).not.toContain('secret-connection-detail');
    });

    it('returns down when postgres fails', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: 'P1001' })),
      };
      const redis = { ping: jest.fn().mockResolvedValue(true) };
      const service = new HealthService(prisma as never, redis as never);
      const result = await service.checkReady();
      expect(result.status).toBe('down');
      const pgCheck = result.checks.find((c) => c.name === 'postgres');
      expect(pgCheck?.status).toBe('down');
      expect(pgCheck?.error).toBe('P1001');
    });
  });
});
