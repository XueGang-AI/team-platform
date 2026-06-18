import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { apiEnvSchema, loadEnv } from '@team-platform/config';
import { LOG_REDACTION_PATHS } from '@team-platform/logger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { resolveRequestId } from './common/request-id/request-id';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { VersionModule } from './version/version.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 所有环境变量在运行时经 zod 校验，校验失败立即终止启动
      validate: (config) => loadEnv(apiEnvSchema, config as Record<string, string | undefined>),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL'),
          base: {
            service_name: config.get<string>('SERVICE_NAME'),
            environment: config.get<string>('ENVIRONMENT'),
            version: config.get<string>('API_VERSION'),
          },
          redact: { paths: LOG_REDACTION_PATHS, censor: '[REDACTED]' },
          // 接收合法入站 request id 或自动生成，并写回响应头
          genReqId: (req, res) => resolveRequestId(req, res),
          customProps: (req) => ({ request_id: (req as { id?: string }).id }),
          // 仅开发环境启用 pretty，测试/生产输出 JSON
          transport:
            config.get<string>('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    VersionModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
