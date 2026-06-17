import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KafkaService } from "./kafka.service";

@Global()
@Module({
  providers: [
    {
      provide: KafkaService,
      useFactory: (config: ConfigService) => new KafkaService(config),
      inject: [ConfigService],
    },
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
