import { Injectable } from '@nestjs/common';
import type { InputJsonValue } from '@prisma/client/runtime/client';
import type { AuditEventDTO, ActorType } from '@team-platform/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { mapAuditEvent } from './audit.mapper';

const sensitiveKeys = ['token', 'secret', 'password', 'credential', 'authorization'];

interface RecordAuditInput {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  projectId?: string | null;
  payload?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput): Promise<AuditEventDTO> {
    const event = await this.prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        projectId: input.projectId ?? null,
        payload: redact(input.payload ?? {}) as InputJsonValue,
        ip: input.ip ?? null,
      },
    });
    return mapAuditEvent(event);
  }

  async list(projectId?: string): Promise<AuditEventDTO[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return events.map(mapAuditEvent);
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
        ? '[REDACTED]'
        : redact(entry);
    }
    return result;
  }
  return value;
}
