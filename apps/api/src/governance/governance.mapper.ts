import type { GovernanceRecordDTO } from '@team-platform/contracts';
import type { GovernanceRecordModel } from '../generated/prisma/models/GovernanceRecord';

export function mapGovernanceRecord(record: GovernanceRecordModel): GovernanceRecordDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    serviceId: record.serviceId,
    environmentSlug: record.environmentSlug,
    kind: record.kind,
    name: record.name,
    status: record.status,
    data: record.data,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
