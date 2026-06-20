import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

const SENSITIVE_KEYS = new Set([
  'accessToken',
  'authorization',
  'jwt',
  'nonce',
  'privateKey',
  'refreshToken',
  'secret',
  'signature',
  'token',
]);

type AuditInput = {
  address: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async log(input: AuditInput): Promise<AuditLog> {
    const auditLog = this.auditLogs.create({
      address: input.address,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'success',
      metadata: scrubMetadata(input.metadata ?? {}) as Record<string, unknown>,
    });

    return this.auditLogs.save(auditLog);
  }
}

function scrubMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubMetadata);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    clean[key] = scrubMetadata(child);
  }
  return clean;
}
