import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";

import configuration from "./config/configuration";

// Infrastructure
import { DatabaseModule } from "./infrastructure/database/database.module";
import { KafkaModule } from "./infrastructure/kafka/kafka.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { GoldPriceModule } from "./infrastructure/gold-price/gold-price.module";
import { EmailModule } from "./infrastructure/email/email.module";
import { FxModule } from "./infrastructure/fx/fx.module";
import { SmsModule } from "./infrastructure/sms/sms.module";

// Common
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

// Domain modules
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { MintModule } from "./modules/mint/mint.module";
import { ReserveModule } from "./modules/reserve/reserve.module";

// ── Health check (always public) ────────────────────────────────────────────
import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/guards/jwt-auth.guard";

@Controller()
class HealthController {
  @Public()
  @Get("health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),

    ThrottlerModule.forRoot([
      {
        name: "global",
        ttl: 60_000,
        limit: 100,
      },
      {
        name: "auth",
        ttl: 60_000,
        limit: 10,
      },
    ]),

    ScheduleModule.forRoot(),

    // Infrastructure (all Global)
    DatabaseModule,
    KafkaModule,
    RedisModule,
    GoldPriceModule,
    EmailModule,
    FxModule,
    SmsModule,

    // Domain (Global for audit)
    AuditModule,

    // Feature modules
    AuthModule,
    UsersModule,
    KycModule,
    LedgerModule,
    OrdersModule,
    PaymentsModule,
    MintModule,
    ReserveModule,
  ],

  controllers: [HealthController],

  providers: [
    // Rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // JWT guard applied globally — use @Public() to opt out
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Roles guard runs after JWT guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Audit interceptor for @Audit() decorated routes
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Global exception handler
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
