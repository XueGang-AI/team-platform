import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EnvironmentDTO,
  HealthCheckResultDTO,
  ManifestApplyResult,
  ManifestValidationResult,
  PagedResult,
  ProjectMemberDTO,
  ProjectDTO,
  ProjectDetailDTO,
  ServiceDTO,
  ServiceCredentialDTO,
  ServiceCredentialWithTokenDTO,
  ServiceEndpointDTO,
} from '@team-platform/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateServiceCredentialDto,
  CreateEndpointDto,
  CreateEnvironmentDto,
  CreateProjectDto,
  CreateServiceDto,
  ManifestRequestDto,
  ProjectListQueryDto,
  UpsertProjectMemberDto,
  UpdateEndpointDto,
  UpdateEnvironmentDto,
  UpdateProjectDto,
  UpdateServiceDto,
} from './project-registry.dto';
import { ProjectRegistryService } from './project-registry.service';
import { ProjectSecurityService } from './project-security.service';

@ApiTags('projects')
@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectRegistryController {
  constructor(
    private readonly registry: ProjectRegistryService,
    private readonly security: ProjectSecurityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '项目列表' })
  list(
    @Query() query: ProjectListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PagedResult<ProjectDTO>> {
    return this.registry.listProjects(query, user);
  }

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(
    @Body() body: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDTO> {
    return this.registry.createProject(body, user);
  }

  @Get(':slug')
  @ApiOperation({ summary: '项目详情' })
  get(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailDTO> {
    return this.registry.getProject(slug, user);
  }

  @Patch(':slug')
  @ApiOperation({ summary: '更新项目' })
  update(
    @Param('slug') slug: string,
    @Body() body: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDTO> {
    return this.registry.updateProject(slug, body, user);
  }

  @Post(':slug/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '归档项目' })
  archive(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDTO> {
    return this.registry.archiveProject(slug, user);
  }

  @Post(':slug/services')
  @ApiOperation({ summary: '创建服务' })
  createService(
    @Param('slug') slug: string,
    @Body() body: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceDTO> {
    return this.registry.createService(slug, body, user);
  }

  @Patch(':slug/services/:serviceSlug')
  @ApiOperation({ summary: '更新服务' })
  updateService(
    @Param('slug') slug: string,
    @Param('serviceSlug') serviceSlug: string,
    @Body() body: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceDTO> {
    return this.registry.updateService(slug, serviceSlug, body, user);
  }

  @Post(':slug/environments')
  @ApiOperation({ summary: '创建环境' })
  createEnvironment(
    @Param('slug') slug: string,
    @Body() body: CreateEnvironmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnvironmentDTO> {
    return this.registry.createEnvironment(slug, body, user);
  }

  @Patch(':slug/environments/:environmentSlug')
  @ApiOperation({ summary: '更新环境' })
  updateEnvironment(
    @Param('slug') slug: string,
    @Param('environmentSlug') environmentSlug: string,
    @Body() body: UpdateEnvironmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnvironmentDTO> {
    return this.registry.updateEnvironment(slug, environmentSlug, body, user);
  }

  @Post(':slug/endpoints')
  @ApiOperation({ summary: '创建服务端点' })
  createEndpoint(
    @Param('slug') slug: string,
    @Body() body: CreateEndpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceEndpointDTO> {
    return this.registry.createEndpoint(slug, body, user);
  }

  @Patch(':slug/endpoints/:endpointId')
  @ApiOperation({ summary: '更新服务端点' })
  updateEndpoint(
    @Param('slug') slug: string,
    @Param('endpointId') endpointId: string,
    @Body() body: UpdateEndpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceEndpointDTO> {
    return this.registry.updateEndpoint(slug, endpointId, body, user);
  }

  @Post(':slug/endpoints/:endpointId/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动触发服务端点健康检查' })
  checkEndpoint(
    @Param('slug') slug: string,
    @Param('endpointId') endpointId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HealthCheckResultDTO> {
    return this.registry.checkEndpoint(slug, endpointId, user);
  }

  @Get(':slug/members')
  @ApiOperation({ summary: '项目成员列表' })
  listMembers(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectMemberDTO[]> {
    return this.security.listMembers(slug, user);
  }

  @Post(':slug/members')
  @ApiOperation({ summary: '新增或更新项目成员' })
  upsertMember(
    @Param('slug') slug: string,
    @Body() body: UpsertProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectMemberDTO> {
    return this.security.upsertMember(slug, body, user);
  }

  @Get(':slug/credentials')
  @ApiOperation({ summary: '服务凭证列表' })
  listCredentials(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceCredentialDTO[]> {
    return this.security.listCredentials(slug, user);
  }

  @Post(':slug/credentials')
  @ApiOperation({ summary: '签发服务凭证' })
  createCredential(
    @Param('slug') slug: string,
    @Body() body: CreateServiceCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceCredentialWithTokenDTO> {
    return this.security.createCredential(slug, body, user);
  }

  @Post(':slug/credentials/:credentialId/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '轮换服务凭证' })
  rotateCredential(
    @Param('slug') slug: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceCredentialWithTokenDTO> {
    return this.security.rotateCredential(slug, credentialId, user);
  }

  @Post(':slug/credentials/:credentialId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '吊销服务凭证' })
  revokeCredential(
    @Param('slug') slug: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ServiceCredentialDTO> {
    return this.security.revokeCredential(slug, credentialId, user);
  }
}

@ApiTags('project-manifests')
@Controller('project-manifests')
export class ProjectManifestController {
  constructor(private readonly registry: ProjectRegistryService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '校验项目 manifest' })
  validate(@Body() body: ManifestRequestDto): Promise<ManifestValidationResult> {
    return this.registry.validateManifest(body);
  }

  @Post('apply')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '幂等应用项目 manifest' })
  apply(
    @Body() body: ManifestRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ManifestApplyResult> {
    return this.registry.applyManifest(body, user);
  }
}
