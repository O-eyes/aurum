import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer, Consumer, logLevel } from "kafkajs";
import { v4 as uuid } from "uuid";
import { KafkaMessage } from "@aurum/types";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(private readonly config: ConfigService) {
    this.kafka = new Kafka({
      clientId: config.get<string>("kafka.clientId"),
      brokers: config.get<string[]>("kafka.brokers"),
      logLevel: logLevel.WARN,
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log("Kafka producer connected");
    } catch (err) {
      this.logger.warn(
        `Kafka unavailable — events will be dropped: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.producer.disconnect();
  }

  async publish<T>(
    topic: string,
    eventType: string,
    payload: T,
    meta: { requestId: string; actorId: string },
  ): Promise<void> {
    if (!this.connected) {
      this.logger.warn(`Dropping event ${eventType} — Kafka not connected`);
      return;
    }
    const message: KafkaMessage<T> = {
      eventId: uuid(),
      eventType,
      occurredAt: new Date().toISOString(),
      version: "1.0",
      payload,
      metadata: {
        requestId: meta.requestId,
        actorId: meta.actorId,
        source: "aurum-api",
      },
    };

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: meta.actorId,
            value: JSON.stringify(message),
            headers: {
              "event-type": eventType,
              "request-id": meta.requestId,
            },
          },
        ],
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish ${eventType}: ${(err as Error).message}`,
      );
    }
  }

  createConsumer(groupId: string): Consumer {
    return this.kafka.consumer({ groupId });
  }
}
