import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // 结构化日志（nestjs-pino）作为全局 logger
  app.useLogger(app.get(PinoLogger));

  // 本地开发 CORS
  app.enableCors({ origin: true, credentials: true });

  // 入参校验管道（为后续业务 DTO 预置）
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 优雅关闭：SIGTERM/SIGINT 时触发 onModuleDestroy
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const host = config.get<string>('API_HOST') ?? '0.0.0.0';
  const port = config.get<number>('API_PORT') ?? 3201;

  // OpenAPI 文档挂在 /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.get<string>('SERVICE_NAME') ?? 'team-platform-api')
    .setDescription('team-platform 平台 API')
    .setVersion(config.get<string>('API_VERSION') ?? '0.0.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(port, host);
  new Logger('Bootstrap').log(`API listening on http://${host}:${port} (docs at /docs)`);
}

void bootstrap();
