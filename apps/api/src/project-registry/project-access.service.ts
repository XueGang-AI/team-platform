import { Injectable } from '@nestjs/common';
import type { ProjectRole } from '@team-platform/contracts';
import { ErrorCode } from '../common/errors/error-codes';
import {
  ForbiddenBusinessException,
  NotFoundException,
} from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';

const roleRank: Record<ProjectRole, number> = {
  VIEWER: 1,
  DEVELOPER: 2,
  MAINTAINER: 3,
  OWNER: 4,
};

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireProjectRole(projectSlug: string, userId: string, minimumRole: ProjectRole) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      include: { members: { where: { userId } } },
    });
    if (!project) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND, `项目不存在: ${projectSlug}`);
    }
    const member = project.members[0];
    if (!member || roleRank[member.role] < roleRank[minimumRole]) {
      throw new ForbiddenBusinessException(ErrorCode.PROJECT_ACCESS_DENIED, '无权访问该项目');
    }
    return { project, member };
  }

  async listAccessibleProjectIds(userId: string): Promise<string[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    return members.map((member) => member.projectId);
  }
}
