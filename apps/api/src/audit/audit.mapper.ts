import type { AuditEventDTO } from '@team-platform/contracts';
import type { AuditEventModel } from '../generated/prisma/models/AuditEvent';

export function mapAuditEvent(event: AuditEventModel): AuditEventDTO {
  return {
    id: event.id,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    projectId: event.projectId,
    payload: event.payload,
    ip: event.ip,
    createdAt: event.createdAt.toISOString(),
  };
}
