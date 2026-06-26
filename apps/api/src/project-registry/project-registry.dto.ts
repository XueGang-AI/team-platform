import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  EnvironmentStatus,
  MAX_PAGE_SIZE,
  ProjectSortField,
  ProjectStatus,
  ProjectRole,
  ProjectType,
  ServiceStatus,
  ServiceType,
  SLUG_PATTERN,
} from '@team-platform/contracts';

const projectTypes: ProjectType[] = [
  'WEB_APPLICATION',
  'API_SERVICE',
  'AI_APPLICATION',
  'DATA_SERVICE',
  'INTERNAL_TOOL',
  'OTHER',
];

const projectStatuses: ProjectStatus[] = ['ACTIVE', 'MAINTENANCE', 'ARCHIVED'];
const serviceTypes: ServiceType[] = [
  'WEB',
  'API',
  'WORKER',
  'SCHEDULER',
  'MODEL_SERVICE',
  'DATA_SERVICE',
  'OTHER',
];
const serviceStatuses: ServiceStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const environmentStatuses: EnvironmentStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const sortFields: ProjectSortField[] = ['createdAt', 'updatedAt', 'name', 'slug'];
const projectRoles: ProjectRole[] = ['OWNER', 'MAINTAINER', 'DEVELOPER', 'VIEWER'];

function splitTags(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string');
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class ProjectListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(projectStatuses)
  status?: ProjectStatus;

  @IsOptional()
  @IsIn(projectTypes)
  type?: ProjectType;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @IsIn(sortFields)
  sort?: ProjectSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class CreateProjectDto {
  @IsString()
  @Matches(new RegExp(SLUG_PATTERN))
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(projectTypes)
  type!: ProjectType;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  documentationUrl?: string;

  @IsOptional()
  @Transform(({ value }) => splitTags(value))
  tags?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(projectTypes)
  type?: ProjectType;

  @IsOptional()
  @IsIn(projectStatuses)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ownerName?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string | null;

  @IsOptional()
  @IsString()
  repositoryUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  documentationUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => splitTags(value))
  tags?: string[];
}

export class CreateServiceDto {
  @IsString()
  @Matches(new RegExp(SLUG_PATTERN))
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(serviceTypes)
  type!: ServiceType;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(serviceTypes)
  type?: ServiceType;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(serviceStatuses)
  status?: ServiceStatus;
}

export class CreateEnvironmentDto {
  @IsString()
  @Matches(new RegExp(SLUG_PATTERN))
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(environmentStatuses)
  status?: EnvironmentStatus;
}

export class CreateEndpointDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsNotEmpty()
  environmentId!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsOptional()
  @IsString()
  healthCheckPath?: string;

  @IsOptional()
  @IsBoolean()
  healthCheckEnabled?: boolean;
}

export class UpdateEndpointDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  healthCheckPath?: string | null;

  @IsOptional()
  @IsBoolean()
  healthCheckEnabled?: boolean;
}

export class ManifestRequestDto {
  @Allow()
  manifest!: unknown;
}

export class UpsertProjectMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(projectRoles)
  role!: ProjectRole;
}

export class CreateServiceCredentialDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @Matches(new RegExp(SLUG_PATTERN))
  environmentSlug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
