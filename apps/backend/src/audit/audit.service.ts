import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

const SENSITIVE_KEYS = new Set([
  'accessToken',
  'authorization',
  'jwt',
  'nonce',
  'privateKey',
  'secret',
  'signature',
  'token',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async log(
    address: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown> = {},
    outcome = 'success',
  ): Promise<void> {
    try {
      await this.auditLogs.save(
        this.auditLogs.create({
          address,
          action,
          resourceType,
          resourceId,
          outcome,
          metadata: this.scrubMetadata(metadata),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit log write failed for ${action}: ${message}`);
    }
  }

  private scrubMetadata(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.has(key))
        .map(([key, entry]) => [key, this.scrubValue(entry)]),
    );
  }

  private scrubValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.scrubValue(entry));
    }

    if (value && typeof value === 'object') {
      return this.scrubMetadata(value as Record<string, unknown>);
    }

    return value;
  }
}
