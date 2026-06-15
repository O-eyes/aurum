import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { KafkaTopic } from '../../infrastructure/kafka/kafka.topics';
import { AuditEventInput } from '@aurum/types';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
  ) {}

  // Primary entrypoint — always use this, never write audit_events directly elsewhere.
  // This is intentionally synchronous-looking but fire-and-forget safe to call from interceptors.
  async emit(input: AuditEventInput): Promise<void> {
    const eventId = uuid();

    await this.db.auditEvent.create({
      data: {
        eventId,
        actorId: input.actorId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        requestId: input.requestId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    // Fan-out to Kafka for SIEM / downstream consumers (best-effort, don't fail the write)
    this.kafka
      .publish(
        KafkaTopic.AUDIT_EVENT,
        'AUDIT_EVENT',
        { eventId, actorId: input.actorId, action: input.action, resource: input.resource },
        { requestId: input.requestId, actorId: input.actorId },
      )
      .catch((err: unknown) => {
        this.logger.warn('Audit Kafka fan-out failed (DB write succeeded)', err);
      });
  }

  async query(filters: {
    actorId?: string;
    resource?: string;
    resourceId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    return this.db.auditEvent.findMany({
      where: {
        ...(filters.actorId && { actorId: filters.actorId }),
        ...(filters.resource && { resource: filters.resource }),
        ...(filters.resourceId && { resourceId: filters.resourceId }),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }
}
