import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import {
  ProjectManifestController,
  ProjectRegistryController,
} from './project-registry.controller';
import { ProjectManifestService } from './project-manifest.service';
import { ProjectAccessService } from './project-access.service';
import { ProjectRegistryService } from './project-registry.service';
import { ProjectSecurityService } from './project-security.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ProjectRegistryController, ProjectManifestController],
  providers: [
    ProjectRegistryService,
    ProjectManifestService,
    ProjectAccessService,
    ProjectSecurityService,
  ],
})
export class ProjectRegistryModule {}
