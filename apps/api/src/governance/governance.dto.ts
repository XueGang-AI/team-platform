import { Allow, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { GovernanceRecordKind } from '@team-platform/contracts';

const kinds: GovernanceRecordKind[] = [
  'ALERT_RULE',
  'ALERT_EVENT',
  'CONFIGURATION',
  'SECRET_METADATA',
  'DEPLOYMENT',
  'TASK',
  'FILE_OBJECT',
  'NOTIFICATION',
  'FEATURE_FLAG',
  'MODEL_ROUTE',
  'USAGE_RECORD',
  'COST_RECORD',
  'PROMPT_VERSION',
  'EVALUATION_RUN',
];

export class GovernanceRecordQueryDto {
  @IsOptional()
  @IsIn(kinds)
  kind?: GovernanceRecordKind;
}

export class CreateGovernanceRecordDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  environmentSlug?: string;

  @IsIn(kinds)
  kind!: GovernanceRecordKind;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @Allow()
  data?: unknown;
}

export class CreateGovernanceItemDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  environmentSlug?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @Allow()
  data?: unknown;
}

export class UpdateGovernanceRecordDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;

  @IsOptional()
  @Allow()
  data?: unknown;
}
