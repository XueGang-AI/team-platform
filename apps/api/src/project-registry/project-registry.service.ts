import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateEnvironmentBody,
  CreateProjectBody,
  CreateServiceBody,
  CreateServiceEndpointBody,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  ErrorCode as ContractErrorCode,
  HealthCheckResultDTO,
  ManifestApplyResult,
  ManifestValidationResult,
  MAX_PAGE_SIZE,
  PagedResult,
  ProjectDetailDTO,
  ProjectDTO,
  ProjectListQuery,
  ProjectManifest,
  UpdateEnvironmentBody,
  UpdateProjectBody,
  UpdateServiceBody,
  UpdateServiceEndpointBody,
} from '@team-platform/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ErrorCode } from '../common/errors/error-codes';
import {
  ConflictException,
  NotFoundException,
  ServiceHealthException,
  UnprocessableException,
  ValidationException,
} from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapEndpoint,
  mapEnvironment,
  mapProject,
  mapProjectDetail,
  mapService,
} from './project-registry.mapper';
import { ProjectManifestService } from './project-manifest.service';
import { ProjectAccessService } from './project-access.service';

const DEFAULT_SORT = 'createdAt';
const DEFAULT_ORDER = 'desc';

@Injectable()
export class ProjectRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manifest: ProjectManifestService,
    private readonly config: ConfigService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async listProjects(
    query: ProjectListQuery,
    actor: AuthenticatedUser,
  ): Promise<PagedResult<ProjectDTO>> {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const sort = query.sort ?? DEFAULT_SORT;
    const order = query.order ?? DEFAULT_ORDER;

    const accessibleProjectIds = await this.access.listAccessibleProjectIds(actor.id);
    const where = {
      id: { in: accessibleProjectIds },
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.owner
        ? {
            OR: [
              { ownerName: { contains: query.owner, mode: 'insensitive' as const } },
              { ownerEmail: { contains: query.owner, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { slug: { contains: query.search, mode: 'insensitive' as const } },
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    if (query.tag) {
      const projects = await this.prisma.project.findMany({
        where,
        orderBy: { [sort]: order },
      });
      const filtered = projects.filter((project) => tags(project.tags).includes(query.tag ?? ''));
      return paginate(filtered.map(mapProject), page, pageSize);
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map(mapProject),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async createProject(body: CreateProjectBody, actor: AuthenticatedUser): Promise<ProjectDTO> {
    const existing = await this.prisma.project.findUnique({ where: { slug: body.slug } });
    if (existing) {
      throw new ConflictException(
        ErrorCode.PROJECT_SLUG_CONFLICT,
        `项目 slug 已存在: ${body.slug}`,
      );
    }
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          slug: body.slug,
          name: body.name,
          description: body.description,
          type: body.type,
          ownerName: body.ownerName,
          ownerEmail: body.ownerEmail,
          repositoryUrl: body.repositoryUrl,
          documentationUrl: body.documentationUrl,
          tags: body.tags ?? [],
        },
      });
      await tx.projectMember.create({
        data: { projectId: created.id, userId: actor.id, role: 'OWNER' },
      });
      return created;
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'project.create',
      targetType: 'Project',
      targetId: project.id,
      projectId: project.id,
      payload: { slug: project.slug },
    });
    return mapProject(project);
  }

  async getProject(slug: string, actor: AuthenticatedUser): Promise<ProjectDetailDTO> {
    await this.access.requireProjectRole(slug, actor.id, 'VIEWER');
    const project = await this.findProjectDetail(slug);
    return mapProjectDetail(project);
  }

  async updateProject(
    slug: string,
    body: UpdateProjectBody,
    actor: AuthenticatedUser,
  ): Promise<ProjectDTO> {
    const { project: existing } = await this.access.requireProjectRole(
      slug,
      actor.id,
      'MAINTAINER',
    );
    const project = await this.prisma.project.update({
      where: { slug },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.ownerName !== undefined ? { ownerName: body.ownerName } : {}),
        ...(body.ownerEmail !== undefined ? { ownerEmail: body.ownerEmail } : {}),
        ...(body.repositoryUrl !== undefined ? { repositoryUrl: body.repositoryUrl } : {}),
        ...(body.documentationUrl !== undefined ? { documentationUrl: body.documentationUrl } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'project.update',
      targetType: 'Project',
      targetId: existing.id,
      projectId: existing.id,
      payload: body,
    });
    return mapProject(project);
  }

  async archiveProject(slug: string, actor: AuthenticatedUser): Promise<ProjectDTO> {
    const { project: existing } = await this.access.requireProjectRole(
      slug,
      actor.id,
      'MAINTAINER',
    );
    const project = await this.prisma.project.update({
      where: { slug },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        services: {
          updateMany: {
            where: { archivedAt: null },
            data: { status: 'ARCHIVED', archivedAt: new Date() },
          },
        },
        environments: {
          updateMany: {
            where: { archivedAt: null },
            data: { status: 'ARCHIVED', archivedAt: new Date() },
          },
        },
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'project.archive',
      targetType: 'Project',
      targetId: existing.id,
      projectId: existing.id,
    });
    return mapProject(project);
  }

  async createService(projectSlug: string, body: CreateServiceBody, actor: AuthenticatedUser) {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const project = await this.ensureActiveProject(projectSlug);
    const existing = await this.prisma.service.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: body.slug } },
    });
    if (existing) {
      throw new ConflictException(
        ErrorCode.SERVICE_SLUG_CONFLICT,
        `服务 slug 已存在: ${body.slug}`,
      );
    }
    const service = await this.prisma.service.create({
      data: {
        projectId: project.id,
        slug: body.slug,
        name: body.name,
        type: body.type,
        description: body.description,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service.create',
      targetType: 'Service',
      targetId: service.id,
      projectId: project.id,
      payload: { slug: service.slug },
    });
    return mapService(service);
  }

  async updateService(
    projectSlug: string,
    serviceSlug: string,
    body: UpdateServiceBody,
    actor: AuthenticatedUser,
  ) {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const service = await this.findService(projectSlug, serviceSlug);
    const updated = await this.prisma.service.update({
      where: { id: service.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.status === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service.update',
      targetType: 'Service',
      targetId: updated.id,
      projectId: updated.projectId,
      payload: body,
    });
    return mapService(updated);
  }

  async createEnvironment(
    projectSlug: string,
    body: CreateEnvironmentBody,
    actor: AuthenticatedUser,
  ) {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const project = await this.ensureActiveProject(projectSlug);
    const existing = await this.prisma.environment.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: body.slug } },
    });
    if (existing) {
      throw new ConflictException(
        ErrorCode.ENVIRONMENT_SLUG_CONFLICT,
        `环境 slug 已存在: ${body.slug}`,
      );
    }
    const environment = await this.prisma.environment.create({
      data: {
        projectId: project.id,
        slug: body.slug,
        name: body.name,
        description: body.description,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'environment.create',
      targetType: 'Environment',
      targetId: environment.id,
      projectId: project.id,
      payload: { slug: environment.slug },
    });
    return mapEnvironment(environment);
  }

  async updateEnvironment(
    projectSlug: string,
    environmentSlug: string,
    body: UpdateEnvironmentBody,
    actor: AuthenticatedUser,
  ) {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const environment = await this.findEnvironment(projectSlug, environmentSlug);
    const updated = await this.prisma.environment.update({
      where: { id: environment.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.status === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'environment.update',
      targetType: 'Environment',
      targetId: updated.id,
      projectId: updated.projectId,
      payload: body,
    });
    return mapEnvironment(updated);
  }

  async createEndpoint(
    projectSlug: string,
    body: CreateServiceEndpointBody,
    actor: AuthenticatedUser,
  ) {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const project = await this.ensureActiveProject(projectSlug);
    const [service, environment] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: body.serviceId, projectId: project.id } }),
      this.prisma.environment.findFirst({
        where: { id: body.environmentId, projectId: project.id },
      }),
    ]);
    if (!service || !environment) {
      throw new ValidationException(
        ErrorCode.ENDPOINT_RELATION_INVALID,
        '端点引用的服务或环境不属于该项目',
      );
    }
    const existing = await this.prisma.serviceEndpoint.findUnique({
      where: { serviceId_environmentId: { serviceId: service.id, environmentId: environment.id } },
    });
    if (existing) {
      throw new ConflictException(ErrorCode.ENDPOINT_CONFLICT, '该服务环境端点已存在');
    }
    const endpoint = await this.prisma.serviceEndpoint.create({
      data: {
        serviceId: service.id,
        environmentId: environment.id,
        baseUrl: body.baseUrl,
        healthCheckPath: body.healthCheckPath,
        healthCheckEnabled: body.healthCheckEnabled ?? false,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'endpoint.create',
      targetType: 'ServiceEndpoint',
      targetId: endpoint.id,
      projectId: project.id,
      payload: { serviceId: service.id, environmentId: environment.id },
    });
    return mapEndpoint(endpoint);
  }

  async updateEndpoint(
    projectSlug: string,
    endpointId: string,
    body: UpdateServiceEndpointBody,
    actor: AuthenticatedUser,
  ) {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const endpoint = await this.findEndpoint(projectSlug, endpointId);
    const updated = await this.prisma.serviceEndpoint.update({
      where: { id: endpoint.id },
      data: {
        ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
        ...(body.healthCheckPath !== undefined ? { healthCheckPath: body.healthCheckPath } : {}),
        ...(body.healthCheckEnabled !== undefined
          ? { healthCheckEnabled: body.healthCheckEnabled }
          : {}),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'endpoint.update',
      targetType: 'ServiceEndpoint',
      targetId: updated.id,
      projectId: project.id,
      payload: body,
    });
    return mapEndpoint(updated);
  }

  async validateManifest(raw: unknown): Promise<ManifestValidationResult> {
    const result = this.manifest.validate(raw);
    const existingProjectSlug = result.normalized
      ? ((
          await this.prisma.project.findUnique({
            where: { slug: result.normalized.metadata.slug },
            select: { slug: true },
          })
        )?.slug ?? null)
      : null;

    return {
      valid: result.errors.length === 0 && result.normalized !== null,
      apiVersion: result.apiVersion,
      errors: result.errors,
      warnings: result.warnings,
      normalized: result.normalized,
      existingProjectSlug,
    };
  }

  async applyManifest(raw: unknown, actor: AuthenticatedUser): Promise<ManifestApplyResult> {
    const validation = await this.validateManifest(raw);
    if (!validation.valid || !validation.normalized) {
      throw new ValidationException(
        ErrorCode.MANIFEST_INVALID,
        'manifest 校验失败',
        validation.errors,
      );
    }

    const projectSlug = validation.normalized.metadata.slug;
    const existingProject = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });
    if (existingProject) {
      await this.access.requireProjectRole(projectSlug, actor.id, 'MAINTAINER');
    }

    return this.applyNormalizedManifest(validation.normalized, actor);
  }

  async checkEndpoint(
    projectSlug: string,
    endpointId: string,
    actor: AuthenticatedUser,
  ): Promise<HealthCheckResultDTO> {
    await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const endpoint = await this.findEndpoint(projectSlug, endpointId);
    if (!endpoint.healthCheckEnabled) {
      throw new ServiceHealthException(ErrorCode.HEALTH_CHECK_FAILED, '该端点未启用健康检查');
    }
    const allowedHosts = parseAllowedHosts(
      this.config.get<string>('HEALTH_CHECK_ALLOWED_HOSTS') ?? '',
    );
    const target = buildHealthCheckUrl(endpoint.baseUrl, endpoint.healthCheckPath);
    if (!isAllowedHost(target, allowedHosts)) {
      await this.prisma.serviceEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastHealthStatus: 'UNHEALTHY',
          lastCheckedAt: new Date(),
          lastLatencyMs: null,
          lastErrorCode: ContractErrorCode.HEALTH_CHECK_HOST_NOT_ALLOWED,
        },
      });
      throw new ServiceHealthException(
        ErrorCode.HEALTH_CHECK_HOST_NOT_ALLOWED,
        '健康检查目标主机不在 allowlist 中',
      );
    }

    const startedAt = performance.now();
    const checkedAt = new Date();
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>('HEALTH_CHECK_TIMEOUT_MS') ?? 3000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        headers: { accept: 'application/json,text/plain,*/*' },
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const healthy = response.status >= 200 && response.status < 400;
      const updated = await this.prisma.serviceEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastHealthStatus: healthy ? 'HEALTHY' : 'UNHEALTHY',
          lastCheckedAt: checkedAt,
          lastLatencyMs: latencyMs,
          lastErrorCode: healthy ? null : `HTTP_${response.status}`,
        },
      });
      return {
        endpointId: updated.id,
        status: updated.lastHealthStatus,
        latencyMs: updated.lastLatencyMs,
        checkedAt: updated.lastCheckedAt?.toISOString() ?? checkedAt.toISOString(),
        errorCode: updated.lastErrorCode,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const errorCode =
        err instanceof DOMException && err.name === 'AbortError'
          ? ContractErrorCode.HEALTH_CHECK_TIMEOUT
          : ContractErrorCode.HEALTH_CHECK_FAILED;
      const updated = await this.prisma.serviceEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastHealthStatus: 'UNHEALTHY',
          lastCheckedAt: checkedAt,
          lastLatencyMs: latencyMs,
          lastErrorCode: errorCode,
        },
      });
      return {
        endpointId: updated.id,
        status: updated.lastHealthStatus,
        latencyMs: updated.lastLatencyMs,
        checkedAt: updated.lastCheckedAt?.toISOString() ?? checkedAt.toISOString(),
        errorCode: updated.lastErrorCode,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async applyNormalizedManifest(
    manifest: ProjectManifest,
    actor: AuthenticatedUser,
  ): Promise<ManifestApplyResult> {
    const summary: ManifestApplyResult['summary'] = {
      created: { projects: 0, services: 0, environments: 0, endpoints: 0 },
      updated: { projects: 0, services: 0, environments: 0, endpoints: 0 },
      unchanged: { projects: 0, services: 0, environments: 0, endpoints: 0 },
    };
    const tags = this.manifest.labelsToTags(manifest.metadata.labels);

    const projectId = await this.prisma.$transaction(async (tx) => {
      const existingProject = await tx.project.findUnique({
        where: { slug: manifest.metadata.slug },
      });
      const projectData = {
        name: manifest.metadata.name,
        description: manifest.metadata.description,
        type: manifest.spec.type,
        ownerName: manifest.spec.owner.name,
        ownerEmail: manifest.spec.owner.email,
        repositoryUrl: manifest.spec.repository?.url,
        documentationUrl: manifest.spec.documentation?.url,
        tags,
      };
      const project = existingProject
        ? await tx.project.update({
            where: { id: existingProject.id },
            data: { ...projectData, status: 'ACTIVE', archivedAt: null },
          })
        : await tx.project.create({
            data: { slug: manifest.metadata.slug, ...projectData },
          });
      summary[existingProject ? 'updated' : 'created'].projects += 1;
      if (!existingProject) {
        await tx.projectMember.create({
          data: { projectId: project.id, userId: actor.id, role: 'OWNER' },
        });
      }

      const serviceIds = new Map<string, string>();
      for (const service of manifest.spec.services) {
        const existing = await tx.service.findUnique({
          where: { projectId_slug: { projectId: project.id, slug: service.slug } },
        });
        const data = {
          name: service.name,
          type: service.type,
          description: service.description,
          status: 'ACTIVE' as const,
          archivedAt: null,
        };
        const saved = existing
          ? await tx.service.update({ where: { id: existing.id }, data })
          : await tx.service.create({
              data: { projectId: project.id, slug: service.slug, ...data },
            });
        serviceIds.set(service.slug, saved.id);
        summary[existing ? 'updated' : 'created'].services += 1;
      }

      const environmentIds = new Map<string, string>();
      for (const environment of manifest.spec.environments) {
        const existing = await tx.environment.findUnique({
          where: { projectId_slug: { projectId: project.id, slug: environment.slug } },
        });
        const data = {
          name: environment.name,
          description: environment.description,
          status: 'ACTIVE' as const,
          archivedAt: null,
        };
        const saved = existing
          ? await tx.environment.update({ where: { id: existing.id }, data })
          : await tx.environment.create({
              data: { projectId: project.id, slug: environment.slug, ...data },
            });
        environmentIds.set(environment.slug, saved.id);
        summary[existing ? 'updated' : 'created'].environments += 1;
      }

      for (const endpoint of manifest.spec.endpoints) {
        const serviceId = serviceIds.get(endpoint.service);
        const environmentId = environmentIds.get(endpoint.environment);
        if (!serviceId || !environmentId) {
          throw new ValidationException(ErrorCode.ENDPOINT_RELATION_INVALID, '端点引用关系不合法');
        }
        const existing = await tx.serviceEndpoint.findUnique({
          where: { serviceId_environmentId: { serviceId, environmentId } },
        });
        const data = {
          baseUrl: endpoint.baseUrl,
          healthCheckPath: endpoint.healthCheck?.path,
          healthCheckEnabled: endpoint.healthCheck?.enabled ?? false,
        };
        if (existing) {
          await tx.serviceEndpoint.update({ where: { id: existing.id }, data });
          summary.updated.endpoints += 1;
        } else {
          await tx.serviceEndpoint.create({ data: { serviceId, environmentId, ...data } });
          summary.created.endpoints += 1;
        }
      }

      return project.id;
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'project_manifest.apply',
      targetType: 'Project',
      targetId: projectId,
      projectId,
      payload: { slug: manifest.metadata.slug },
    });

    return {
      applied: true,
      projectSlug: manifest.metadata.slug,
      summary,
      projectId,
    };
  }

  private async ensureProjectExists(slug: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND, `项目不存在: ${slug}`);
    }
    return project;
  }

  private async ensureActiveProject(slug: string) {
    const project = await this.ensureProjectExists(slug);
    if (project.archivedAt || project.status === 'ARCHIVED') {
      throw new UnprocessableException(ErrorCode.PROJECT_ARCHIVED, `项目已归档: ${slug}`);
    }
    return project;
  }

  private async findProjectDetail(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        services: { orderBy: { slug: 'asc' }, include: { endpoints: true } },
        environments: { orderBy: { slug: 'asc' } },
      },
    });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND, `项目不存在: ${slug}`);
    }
    return project;
  }

  private async findService(projectSlug: string, serviceSlug: string) {
    const project = await this.ensureProjectExists(projectSlug);
    const service = await this.prisma.service.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: serviceSlug } },
    });
    if (!service) {
      throw new NotFoundException(ErrorCode.SERVICE_NOT_FOUND, `服务不存在: ${serviceSlug}`);
    }
    return service;
  }

  private async findEnvironment(projectSlug: string, environmentSlug: string) {
    const project = await this.ensureProjectExists(projectSlug);
    const environment = await this.prisma.environment.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: environmentSlug } },
    });
    if (!environment) {
      throw new NotFoundException(
        ErrorCode.ENVIRONMENT_NOT_FOUND,
        `环境不存在: ${environmentSlug}`,
      );
    }
    return environment;
  }

  private async findEndpoint(projectSlug: string, endpointId: string) {
    const project = await this.ensureProjectExists(projectSlug);
    const endpoint = await this.prisma.serviceEndpoint.findFirst({
      where: { id: endpointId, service: { projectId: project.id } },
    });
    if (!endpoint) {
      throw new NotFoundException(ErrorCode.ENDPOINT_NOT_FOUND, `端点不存在: ${endpointId}`);
    }
    return endpoint;
  }
}

function clampPage(value: number | undefined): number {
  return Math.max(1, value ?? DEFAULT_PAGE);
}

function clampPageSize(value: number | undefined): number {
  return Math.max(1, Math.min(MAX_PAGE_SIZE, value ?? DEFAULT_PAGE_SIZE));
}

function paginate<T>(items: T[], page: number, pageSize: number): PagedResult<T> {
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function tags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseAllowedHosts(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildHealthCheckUrl(baseUrl: string, path: string | null): URL {
  const url = new URL(baseUrl);
  if (path) {
    url.pathname = path.startsWith('/') ? path : `/${path}`;
  }
  return url;
}

function isAllowedHost(url: URL, allowedHosts: Set<string>): boolean {
  if (allowedHosts.size === 0) {
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  }
  return allowedHosts.has(url.hostname.toLowerCase()) || allowedHosts.has(url.host.toLowerCase());
}
