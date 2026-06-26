import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectAccessService } from '../project-registry/project-access.service';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService, ProjectAccessService],
})
export class ObservabilityModule {}
