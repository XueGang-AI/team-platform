import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateServiceCredentialBody,
  ProjectMemberDTO,
  ServiceCredentialDTO,
  ServiceCredentialWithTokenDTO,
  UpsertProjectMemberBody,
} from '@team-platform/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ErrorCode } from '../common/errors/error-codes';
import {
  ForbiddenBusinessException,
  NotFoundException,
} from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from './project-access.service';
import {
  mapProjectMember,
  mapServiceCredential,
  mapServiceCredentialWithToken,
} from './project-security.mapper';

@Injectable()
export class ProjectSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async listMembers(projectSlug: string, actor: AuthenticatedUser): Promise<ProjectMemberDTO[]> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'VIEWER');
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return members.map(mapProjectMember);
  }

  async upsertMember(
    projectSlug: string,
    body: UpsertProjectMemberBody,
    actor: AuthenticatedUser,
  ): Promise<ProjectMemberDTO> {
    const { project, member: actorMember } = await this.access.requireProjectRole(
      projectSlug,
      actor.id,
      'MAINTAINER',
    );
    const email = body.email.trim().toLowerCase();
    if (body.role === 'OWNER' && actorMember.role !== 'OWNER') {
      throw new ForbiddenBusinessException(
        ErrorCode.PROJECT_ACCESS_DENIED,
        '只有项目 OWNER 可以授予 OWNER 角色',
      );
    }
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { projectMembers: { where: { projectId: project.id } } },
    });
    const existingMember = existingUser?.projectMembers[0];
    if (existingMember?.role === 'OWNER' && actorMember.role !== 'OWNER') {
      throw new ForbiddenBusinessException(
        ErrorCode.PROJECT_ACCESS_DENIED,
        '只有项目 OWNER 可以修改 OWNER 成员',
      );
    }
    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { name: body.name.trim() },
        })
      : await this.prisma.user.create({
          data: { email, name: body.name.trim() },
        });
    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      create: { projectId: project.id, userId: user.id, role: body.role },
      update: { role: body.role },
      include: { user: true },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'project.member.upsert',
      targetType: 'ProjectMember',
      targetId: member.id,
      projectId: project.id,
      payload: { email: user.email, role: body.role },
    });
    return mapProjectMember(member);
  }

  async listCredentials(
    projectSlug: string,
    actor: AuthenticatedUser,
  ): Promise<ServiceCredentialDTO[]> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'VIEWER');
    const credentials = await this.prisma.serviceCredential.findMany({
      where: { service: { projectId: project.id } },
      orderBy: { issuedAt: 'desc' },
    });
    return credentials.map(mapServiceCredential);
  }

  async createCredential(
    projectSlug: string,
    body: CreateServiceCredentialBody,
    actor: AuthenticatedUser,
  ): Promise<ServiceCredentialWithTokenDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'MAINTAINER');
    const service = await this.prisma.service.findFirst({
      where: { id: body.serviceId, projectId: project.id },
    });
    if (!service) {
      throw new NotFoundException(ErrorCode.SERVICE_NOT_FOUND, '服务不存在');
    }
    const token = `tp_${randomBytes(32).toString('base64url')}`;
    const credential = await this.prisma.serviceCredential.create({
      data: {
        serviceId: service.id,
        environmentSlug: body.environmentSlug,
        name: body.name,
        tokenHash: hashToken(token),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: actor.id,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service_credential.create',
      targetType: 'ServiceCredential',
      targetId: credential.id,
      projectId: project.id,
      payload: { serviceId: service.id, environmentSlug: body.environmentSlug, name: body.name },
    });
    return mapServiceCredentialWithToken(credential, token);
  }

  async rotateCredential(
    projectSlug: string,
    credentialId: string,
    actor: AuthenticatedUser,
  ): Promise<ServiceCredentialWithTokenDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'MAINTAINER');
    const credential = await this.findCredential(project.id, credentialId);
    const token = `tp_${randomBytes(32).toString('base64url')}`;
    const updated = await this.prisma.serviceCredential.update({
      where: { id: credential.id },
      data: {
        tokenHash: hashToken(token),
        status: 'ACTIVE',
        rotatedAt: new Date(),
        revokedAt: null,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service_credential.rotate',
      targetType: 'ServiceCredential',
      targetId: updated.id,
      projectId: project.id,
    });
    return mapServiceCredentialWithToken(updated, token);
  }

  async revokeCredential(
    projectSlug: string,
    credentialId: string,
    actor: AuthenticatedUser,
  ): Promise<ServiceCredentialDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'MAINTAINER');
    const credential = await this.findCredential(project.id, credentialId);
    const updated = await this.prisma.serviceCredential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service_credential.revoke',
      targetType: 'ServiceCredential',
      targetId: updated.id,
      projectId: project.id,
    });
    return mapServiceCredential(updated);
  }

  private async findCredential(projectId: string, credentialId: string) {
    const credential = await this.prisma.serviceCredential.findFirst({
      where: { id: credentialId, service: { projectId } },
    });
    if (!credential) {
      throw new NotFoundException(ErrorCode.SERVICE_CREDENTIAL_NOT_FOUND, '服务凭证不存在');
    }
    return credential;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
