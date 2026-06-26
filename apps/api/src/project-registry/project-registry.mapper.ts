import type {
  EnvironmentDTO,
  ProjectDTO,
  ProjectDetailDTO,
  ServiceDTO,
  ServiceEndpointDTO,
} from '@team-platform/contracts';
import type { EnvironmentModel } from '../generated/prisma/models/Environment';
import type { ProjectModel } from '../generated/prisma/models/Project';
import type { ServiceModel } from '../generated/prisma/models/Service';
import type { ServiceEndpointModel } from '../generated/prisma/models/ServiceEndpoint';

type ProjectWithRelations = ProjectModel & {
  services: Array<ServiceModel & { endpoints: ServiceEndpointModel[] }>;
  environments: EnvironmentModel[];
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((tag): tag is string => typeof tag === 'string');
}

export function mapProject(project: ProjectModel): ProjectDTO {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    type: project.type,
    status: project.status,
    ownerName: project.ownerName,
    ownerEmail: project.ownerEmail,
    repositoryUrl: project.repositoryUrl,
    documentationUrl: project.documentationUrl,
    tags: normalizeTags(project.tags),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    archivedAt: iso(project.archivedAt),
  };
}

export function mapService(service: ServiceModel): ServiceDTO {
  return {
    id: service.id,
    projectId: service.projectId,
    slug: service.slug,
    name: service.name,
    type: service.type,
    description: service.description,
    status: service.status,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    archivedAt: iso(service.archivedAt),
  };
}

export function mapEnvironment(environment: EnvironmentModel): EnvironmentDTO {
  return {
    id: environment.id,
    projectId: environment.projectId,
    slug: environment.slug,
    name: environment.name,
    description: environment.description,
    status: environment.status,
    createdAt: environment.createdAt.toISOString(),
    updatedAt: environment.updatedAt.toISOString(),
    archivedAt: iso(environment.archivedAt),
  };
}

export function mapEndpoint(endpoint: ServiceEndpointModel): ServiceEndpointDTO {
  return {
    id: endpoint.id,
    serviceId: endpoint.serviceId,
    environmentId: endpoint.environmentId,
    baseUrl: endpoint.baseUrl,
    healthCheckPath: endpoint.healthCheckPath,
    healthCheckEnabled: endpoint.healthCheckEnabled,
    lastHealthStatus: endpoint.lastHealthStatus,
    lastCheckedAt: iso(endpoint.lastCheckedAt),
    lastLatencyMs: endpoint.lastLatencyMs,
    lastErrorCode: endpoint.lastErrorCode,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

export function mapProjectDetail(project: ProjectWithRelations): ProjectDetailDTO {
  const endpoints = project.services.flatMap((service) => service.endpoints);

  return {
    ...mapProject(project),
    services: project.services.map(mapService),
    environments: project.environments.map(mapEnvironment),
    endpoints: endpoints.map(mapEndpoint),
  };
}
