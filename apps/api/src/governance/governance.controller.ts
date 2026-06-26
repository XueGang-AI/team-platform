import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GovernanceRecordDTO } from '@team-platform/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateGovernanceRecordDto,
  GovernanceRecordQueryDto,
  UpdateGovernanceRecordDto,
} from './governance.dto';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@Controller('projects/:slug/governance-records')
@UseGuards(AuthGuard)
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get()
  @ApiOperation({ summary: '项目治理记录列表' })
  list(
    @Param('slug') slug: string,
    @Query() query: GovernanceRecordQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO[]> {
    return this.governance.list(slug, user, query.kind);
  }

  @Post()
  @ApiOperation({ summary: '创建项目治理记录' })
  create(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.governance.create(slug, body, user);
  }

  @Patch(':recordId')
  @ApiOperation({ summary: '更新项目治理记录' })
  update(
    @Param('slug') slug: string,
    @Param('recordId') recordId: string,
    @Body() body: UpdateGovernanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.governance.update(slug, recordId, body, user);
  }
}
