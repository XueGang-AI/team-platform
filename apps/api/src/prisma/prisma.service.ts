import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * 控制面 PostgreSQL 访问（Prisma 7 + @prisma/adapter-pg driver adapter）。
 *
 * Prisma 7 不再从 schema 读取 datasource.url，运行时通过 adapter 注入连接串。
 * 连接串来自经 @team-platform/config 校验的环境变量，不在此处记录。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
