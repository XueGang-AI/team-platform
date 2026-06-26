import type { UserModel } from '../generated/prisma/models/User';

export type AuthenticatedUser = UserModel;

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
