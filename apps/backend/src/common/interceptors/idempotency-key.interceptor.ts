import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { defer, mergeMap, Observable, of } from 'rxjs';
import { QueryFailedError, Repository } from 'typeorm';
import { IdempotencyRecord } from '../../entities/idempotency-record.entity';

type RequestWithUser = Request & { user?: { address?: string } };

@Injectable()
export class IdempotencyKeyInterceptor implements NestInterceptor {
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly records: Repository<IdempotencyRecord>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const res = http.getResponse<Response>();
    const key = this.extractKey(req);
    const requestHash = this.hash(this.serialize(this.buildRequestFingerprint(req)));

    return defer(async () => {
      const existing = await this.records.findOne({ where: { key } });
      if (!existing) {
        return { replayed: false as const, key, requestHash };
      }

      if (existing.expiresAt.getTime() <= Date.now()) {
        await this.records.delete({ key });
        return { replayed: false as const, key, requestHash };
      }

      if (existing.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key reuse with different payload is not allowed');
      }

      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.statusCode);
      return { replayed: true as const, responseBody: JSON.parse(existing.responseBody) as unknown };
    }).pipe(
      mergeMap((state) => {
        if (state.replayed) {
          return of(state.responseBody);
        }

        return next.handle().pipe(
          mergeMap(async (responseBody) => {
            const serializedResponse = this.serialize(responseBody);
            const record = this.records.create({
              key: state.key,
              requestHash: state.requestHash,
              responseHash: this.hash(serializedResponse),
              responseBody: serializedResponse,
              statusCode: res.statusCode,
              expiresAt: new Date(Date.now() + this.ttlMs),
            });

            try {
              await this.records.insert(record);
            } catch (error) {
              if (!this.isUniqueViolation(error)) {
                throw error;
              }

              const concurrent = await this.records.findOne({ where: { key: state.key } });
              if (!concurrent) {
                throw error;
              }
              if (concurrent.expiresAt.getTime() <= Date.now()) {
                await this.records.delete({ key: state.key });
                await this.records.insert(record);
                return responseBody;
              }
              if (concurrent.requestHash !== state.requestHash) {
                throw new ConflictException(
                  'Idempotency key reuse with different payload is not allowed',
                );
              }
            }

            return responseBody;
          }),
        );
      }),
    );
  }

  private extractKey(req: Request): string {
    const headerValue = req.header('Idempotency-Key');
    if (!headerValue || headerValue.trim().length === 0) {
      throw new BadRequestException('Missing Idempotency-Key header');
    }
    return headerValue.trim();
  }

  private buildRequestFingerprint(req: RequestWithUser): Record<string, unknown> {
    return {
      method: req.method,
      route: req.originalUrl ?? req.url,
      params: req.params ?? {},
      query: req.query ?? {},
      body: req.body ?? {},
      actor: req.user?.address ?? null,
    };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private serialize(value: unknown): string {
    return JSON.stringify(this.sortObject(value));
  }

  private sortObject(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObject(item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      return Object.fromEntries(entries.map(([k, v]) => [k, this.sortObject(v)]));
    }
    return value;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as { code?: string }).code === '23505';
  }
}
