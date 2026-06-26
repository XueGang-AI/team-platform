import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  GovernanceDashboardDTO,
  GovernanceRecordDTO,
  GovernanceRecordKind,
} from '@team-platform/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateGovernanceItemDto } from './governance.dto';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@Controller('projects/:slug')
@UseGuards(AuthGuard)
export class GovernanceFacadeController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('governance-dashboard')
  @ApiOperation({ summary: '项目治理总览' })
  dashboard(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceDashboardDTO> {
    return this.governance.dashboard(slug, user);
  }

  @Post('alerts/rules')
  @ApiOperation({ summary: '创建告警规则' })
  createAlertRule(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'ALERT_RULE', body, user);
  }

  @Post('alerts/events')
  @ApiOperation({ summary: '创建告警事件' })
  createAlertEvent(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'ALERT_EVENT', body, user);
  }

  @Post('deployments')
  @ApiOperation({ summary: '记录发布事件' })
  createDeployment(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'DEPLOYMENT', body, user);
  }

  @Post('configurations')
  @ApiOperation({ summary: '登记配置元数据' })
  createConfiguration(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'CONFIGURATION', body, user);
  }

  @Post('secret-references')
  @ApiOperation({ summary: '登记外部密钥引用' })
  createSecretReference(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'SECRET_METADATA', body, user);
  }

  @Post('cost-records')
  @ApiOperation({ summary: '记录成本聚合' })
  createCostRecord(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'COST_RECORD', body, user);
  }

  @Post('model-routes')
  @ApiOperation({ summary: '登记模型路由' })
  createModelRoute(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'MODEL_ROUTE', body, user);
  }

  @Post('prompt-versions')
  @ApiOperation({ summary: '登记 Prompt 版本' })
  createPromptVersion(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'PROMPT_VERSION', body, user);
  }

  @Post('evaluation-runs')
  @ApiOperation({ summary: '登记模型评测运行' })
  createEvaluationRun(
    @Param('slug') slug: string,
    @Body() body: CreateGovernanceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.create(slug, 'EVALUATION_RUN', body, user);
  }

  private create(
    slug: string,
    kind: GovernanceRecordKind,
    body: CreateGovernanceItemDto,
    user: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.governance.createWithKind(slug, kind, body, user);
  }
}
