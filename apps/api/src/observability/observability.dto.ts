import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import type { ObservabilitySignal } from '@team-platform/contracts';

const signals: ObservabilitySignal[] = ['LOGS', 'METRICS', 'TRACES', 'DASHBOARD'];

export class CreateObservabilityLinkDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  environmentSlug?: string;

  @IsIn(signals)
  signal!: ObservabilitySignal;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsUrl({ require_tld: false })
  url!: string;
}
