import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LiveResponse, ReadyResponse } from '@team-platform/contracts';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '进程存活检查（不检查依赖）' })
  live(): LiveResponse {
    return this.health.live();
  }

  @Get('ready')
  @ApiOperation({ summary: '就绪检查：真实检查 PostgreSQL 与 Redis' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadyResponse> {
    const result = await this.health.checkReady();
    if (result.status !== 'ok') {
      // 未就绪返回 503，但响应体仍是 ReadyResponse（非错误结构），便于调用方解析依赖状态
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
