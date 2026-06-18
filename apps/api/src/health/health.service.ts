import { Injectable } from '@nestjs/common';
import {
  ComponentStatus,
  ComponentStatusValue,
  LiveResponse,
  ReadyResponse,
  deriveOverallStatus,
} from '@team-platform/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * 从异常中提取非敏感错误描述：只返回稳定的错误码（如 ECONNREFUSED / P1001），
 * 不返回 message（可能含主机/端口/连接串），不返回堆栈。
 */
function safeErrorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) {
      return code;
    }
  }
  return 'unavailable';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** live：仅表示 API 进程存活，不检查依赖 */
  live(): LiveResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** ready：真实检查 PostgreSQL 与 Redis */
  async checkReady(): Promise<ReadyResponse> {
    const checks = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const status: ComponentStatusValue = deriveOverallStatus(checks);
    return { status, checks, timestamp: new Date().toISOString() };
  }

  private async checkPostgres(): Promise<ComponentStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'postgres', status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        name: 'postgres',
        status: 'down',
        latencyMs: Date.now() - start,
        error: safeErrorCode(err),
      };
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const start = Date.now();
    try {
      const ok = await this.redis.ping();
      return {
        name: 'redis',
        status: ok ? 'ok' : 'down',
        latencyMs: Date.now() - start,
        ...(ok ? {} : { error: 'unavailable' }),
      };
    } catch (err) {
      return {
        name: 'redis',
        status: 'down',
        latencyMs: Date.now() - start,
        error: safeErrorCode(err),
      };
    }
  }
}
