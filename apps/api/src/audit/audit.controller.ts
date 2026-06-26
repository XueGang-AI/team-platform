import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditEventDTO } from '@team-platform/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit-events')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: '审计事件列表（最近 100 条）' })
  list(@Query('projectId') projectId?: string): Promise<AuditEventDTO[]> {
    return this.audit.list(projectId);
  }
}
