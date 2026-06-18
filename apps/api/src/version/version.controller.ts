import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionResponse } from '@team-platform/contracts';

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: '返回服务版本信息' })
  version(): VersionResponse {
    return {
      name: this.config.get<string>('SERVICE_NAME') ?? 'team-platform-api',
      version: this.config.get<string>('API_VERSION') ?? '0.0.0',
      environment: this.config.get<string>('ENVIRONMENT') ?? 'dev',
      node: process.version,
    };
  }
}
