import { Injectable } from '@nestjs/common';
import type {
  CreateGovernanceItemBody,
  CreateGovernanceRecordBody,
  GovernanceDashboardDTO,
  GovernanceRecordDTO,
  GovernanceRecordKind,
  UpdateGovernanceRecordBody,
} from '@team-platform/contracts';
import type { InputJsonValue } from '@prisma/client/runtime/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ErrorCode } from '../common/errors/error-codes';
import { NotFoundException, ValidationException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../project-registry/project-access.service';
import { mapGovernanceRecord } from './governance.mapper';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(
    projectSlug: string,
    actor: AuthenticatedUser,
    kind?: GovernanceRecordKind,
  ): Promise<GovernanceRecordDTO[]> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'VIEWER');
    const records = await this.prisma.governanceRecord.findMany({
      where: { projectId: project.id, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return records.map(mapGovernanceRecord);
  }

  async create(
    projectSlug: string,
    body: CreateGovernanceRecordBody,
    actor: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.createRecord(projectSlug, body.kind, body, actor);
  }

  async createWithKind(
    projectSlug: string,
    kind: GovernanceRecordKind,
    body: CreateGovernanceItemBody,
    actor: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    return this.createRecord(projectSlug, kind, body, actor);
  }

  async dashboard(projectSlug: string, actor: AuthenticatedUser): Promise<GovernanceDashboardDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'VIEWER');
    const records = await this.prisma.governanceRecord.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const mapped = records.map(mapGovernanceRecord);
    const alerts = mapped.filter((record) => ['ALERT_RULE', 'ALERT_EVENT'].includes(record.kind));
    const deployments = mapped.filter((record) => record.kind === 'DEPLOYMENT');
    const configurations = mapped.filter((record) => record.kind === 'CONFIGURATION');
    const secretReferences = mapped.filter((record) => record.kind === 'SECRET_METADATA');
    const costRecords = mapped.filter((record) => record.kind === 'COST_RECORD');
    const modelRoutes = mapped.filter((record) => record.kind === 'MODEL_ROUTE');
    const tasks = mapped.filter((record) => record.kind === 'TASK');
    const promptEvaluations = mapped.filter((record) =>
      ['PROMPT_VERSION', 'EVALUATION_RUN'].includes(record.kind),
    );

    return {
      summary: {
        activeAlerts: alerts.filter((record) => !isClosedStatus(record.status)).length,
        openDeployments: deployments.filter((record) => !isClosedStatus(record.status)).length,
        monthlyCostCents: costRecords.reduce(
          (sum, record) => sum + readAmountCents(record.data),
          0,
        ),
        activeModelRoutes: modelRoutes.filter((record) => !isClosedStatus(record.status)).length,
        configurationItems: configurations.length,
        secretReferences: secretReferences.length,
      },
      alerts,
      deployments,
      configurations,
      secretReferences,
      costRecords,
      modelRoutes,
      tasks,
      promptEvaluations,
    };
  }

  private async createRecord(
    projectSlug: string,
    kind: GovernanceRecordKind,
    body: CreateGovernanceItemBody,
    actor: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    await this.validateService(project.id, body.serviceId);
    const record = await this.prisma.governanceRecord.create({
      data: {
        projectId: project.id,
        serviceId: body.serviceId,
        environmentSlug: body.environmentSlug,
        kind,
        name: body.name,
        status: body.status,
        data: (body.data ?? {}) as InputJsonValue,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: `governance.${kind.toLowerCase()}.create`,
      targetType: 'GovernanceRecord',
      targetId: record.id,
      projectId: project.id,
      payload: { kind, name: body.name, status: body.status },
    });
    return mapGovernanceRecord(record);
  }

  async update(
    projectSlug: string,
    recordId: string,
    body: UpdateGovernanceRecordBody,
    actor: AuthenticatedUser,
  ): Promise<GovernanceRecordDTO> {
    const { project } = await this.access.requireProjectRole(projectSlug, actor.id, 'DEVELOPER');
    const existing = await this.prisma.governanceRecord.findFirst({
      where: { id: recordId, projectId: project.id },
    });
    if (!existing) {
      throw new NotFoundException(ErrorCode.GOVERNANCE_RECORD_NOT_FOUND, '治理记录不存在');
    }
    const record = await this.prisma.governanceRecord.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.data !== undefined ? { data: body.data as InputJsonValue } : {}),
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: `governance.${record.kind.toLowerCase()}.update`,
      targetType: 'GovernanceRecord',
      targetId: record.id,
      projectId: project.id,
      payload: body,
    });
    return mapGovernanceRecord(record);
  }

  private async validateService(projectId: string, serviceId: string | undefined): Promise<void> {
    if (!serviceId) {
      return;
    }
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, projectId } });
    if (!service) {
      throw new ValidationException(ErrorCode.ENDPOINT_RELATION_INVALID, '服务不属于该项目');
    }
  }
}

function isClosedStatus(status: string): boolean {
  return ['closed', 'resolved', 'success', 'succeeded', 'completed', 'done', 'inactive'].includes(
    status.trim().toLowerCase(),
  );
}

function readAmountCents(data: unknown): number {
  if (!data || typeof data !== 'object') {
    return 0;
  }
  const amount = (data as { amountCents?: unknown; costCents?: unknown }).amountCents;
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return amount;
  }
  const cost = (data as { amountCents?: unknown; costCents?: unknown }).costCents;
  if (typeof cost === 'number' && Number.isFinite(cost)) {
    return cost;
  }
  return 0;
}
