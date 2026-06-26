import type { ObservabilityLinkDTO } from '@team-platform/contracts';
import type { ObservabilityLinkModel } from '../generated/prisma/models/ObservabilityLink';

export function mapObservabilityLink(link: ObservabilityLinkModel): ObservabilityLinkDTO {
  return {
    id: link.id,
    projectId: link.projectId,
    serviceId: link.serviceId,
    environmentSlug: link.environmentSlug,
    signal: link.signal,
    title: link.title,
    url: link.url,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}
