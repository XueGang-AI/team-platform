import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectAccessService } from '../project-registry/project-access.service';
import { GovernanceController } from './governance.controller';
import { GovernanceFacadeController } from './governance-facade.controller';
import { GovernanceService } from './governance.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [GovernanceController, GovernanceFacadeController],
  providers: [GovernanceService, ProjectAccessService],
})
export class GovernanceModule {}
