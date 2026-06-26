import { Injectable } from '@nestjs/common';
import type { CreateObservabilityLinkBody, ObservabilityLinkDTO } from '@team-platform/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ErrorCode } from '../common/errors/error-codes';
import { ValidationException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../project-registry/project-access.service';
import { mapObservabilityLink } from './observability.mapper';

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(projectSlug: string, actor: AuthenticatedUser): Promise<ObservabilityLinkDTO[]> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'VIEWER');
    const links = await this.prisma.observabilityLink.findMany({
      where: { projectId: project.id },
      orderBy: [{ signal: 'asc' }, { createdAt: 'desc' }],
    });
    return links.map(mapObservabilityLink);
  }

  async create(
    projectSlug: string,
    body: CreateObservabilityLinkBody,
    actor: AuthenticatedUser,
  ): Promise<ObservabilityLinkDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    if (body.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: body.serviceId, projectId: project.id },
      });
      if (!service) {
        throw new ValidationException(ErrorCode.ENDPOINT_RELATION_INVALID, '服务不属于该项目');
      }
    }
    const link = await this.prisma.observabilityLink.create({
      data: {
        projectId: project.id,
        serviceId: body.serviceId,
        environmentSlug: body.environmentSlug,
        signal: body.signal,
        title: body.title,
        url: body.url,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'observability_link.create',
      targetType: 'ObservabilityLink',
      targetId: link.id,
      projectId: project.id,
      payload: { signal: link.signal, title: link.title, url: link.url },
    });
    return mapObservabilityLink(link);
  }
}
