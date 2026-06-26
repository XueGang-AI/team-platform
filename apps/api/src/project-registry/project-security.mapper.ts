import type {
  ProjectMemberDTO,
  ServiceCredentialDTO,
  ServiceCredentialWithTokenDTO,
} from '@team-platform/contracts';
import { mapUser } from '../auth/auth.mapper';
import type { ProjectMemberModel } from '../generated/prisma/models/ProjectMember';
import type { ServiceCredentialModel } from '../generated/prisma/models/ServiceCredential';
import type { UserModel } from '../generated/prisma/models/User';

type ProjectMemberWithUser = ProjectMemberModel & { user: UserModel };

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function mapProjectMember(member: ProjectMemberWithUser): ProjectMemberDTO {
  return {
    id: member.id,
    projectId: member.projectId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    user: mapUser(member.user),
  };
}

export function mapServiceCredential(credential: ServiceCredentialModel): ServiceCredentialDTO {
  return {
    id: credential.id,
    serviceId: credential.serviceId,
    environmentSlug: credential.environmentSlug,
    name: credential.name,
    status: credential.status,
    issuedAt: credential.issuedAt.toISOString(),
    rotatedAt: iso(credential.rotatedAt),
    revokedAt: iso(credential.revokedAt),
    expiresAt: iso(credential.expiresAt),
    createdByUserId: credential.createdByUserId,
  };
}

export function mapServiceCredentialWithToken(
  credential: ServiceCredentialModel,
  token: string,
): ServiceCredentialWithTokenDTO {
  return { ...mapServiceCredential(credential), token };
}
