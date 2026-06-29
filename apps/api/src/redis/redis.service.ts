import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 统一客户端。Phase 1 仅提供连接与 PING，不实现缓存/队列/锁等业务能力。
 *
 * 安全/稳定性：
 * - 错误事件被捕获并记录，不冒泡导致进程崩溃；
 * - 连接超时与重试上限受控，避免依赖故障时无限阻塞；
 * - 日志不记录连接串（连接串来自校验后的环境变量，不输出）。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL is required');
    }
    const keyPrefix = config.get<string>('REDIS_KEY_PREFIX') ?? 'team_platform:';
    this.client = new Redis(url, {
      keyPrefix,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
    });
    this.client.on('error', (err: Error & { code?: string }) => {
      // 仅记录非敏感错误码，不输出连接串
      this.logger.warn(`Redis error: ${err.code ?? 'unavailable'}`);
    });
  }

  /** readiness 检查：PING 返回 PONG 视为就绪，带超时避免坏连接挂起 */
  async ping(): Promise<boolean> {
    try {
      const res = await this.timeout(this.client.ping(), 2000);
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  private timeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
