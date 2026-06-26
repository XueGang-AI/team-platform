import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ObservabilityLinkDTO } from '@team-platform/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateObservabilityLinkDto } from './observability.dto';
import { ObservabilityService } from './observability.service';

@ApiTags('observability')
@Controller('projects/:slug/observability-links')
@UseGuards(AuthGuard)
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Get()
  @ApiOperation({ summary: '项目可观测性入口列表' })
  list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ObservabilityLinkDTO[]> {
    return this.observability.list(slug, user);
  }

  @Post()
  @ApiOperation({ summary: '创建项目可观测性入口' })
  create(
    @Param('slug') slug: string,
    @Body() body: CreateObservabilityLinkDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ObservabilityLinkDTO> {
    return this.observability.create(slug, body, user);
  }
}
