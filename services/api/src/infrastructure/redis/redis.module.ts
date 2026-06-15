import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (config: ConfigService) => new RedisService(config),
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
