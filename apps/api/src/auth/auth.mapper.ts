import type { UserDTO } from '@team-platform/contracts';
import type { UserModel } from '../generated/prisma/models/User';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function mapUser(user: UserModel): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    disabledAt: iso(user.disabledAt),
  };
}
