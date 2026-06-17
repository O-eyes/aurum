import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PaymentsController,
  PayoutsController,
  PaymentsWebhookController,
} from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PayoutsService } from "./payouts.service";
import { PAYMENT_PROVIDER } from "./payment.provider.interface";
import { PaystackProvider } from "./providers/paystack.provider";
import { OrdersModule } from "../orders/orders.module";
import { LedgerModule } from "../ledger/ledger.module";

@Module({
  imports: [OrdersModule, LedgerModule],
  controllers: [
    PaymentsController,
    PayoutsController,
    PaymentsWebhookController,
  ],
  providers: [
    PaymentsService,
    PayoutsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService): PaystackProvider => {
        const secretKey = config.get<string>("paystack.secretKey") ?? "";
        const baseUrl =
          config.get<string>("paystack.baseUrl") ?? "https://api.paystack.co";

        if (!secretKey) {
          throw new Error(
            "PAYSTACK_SECRET_KEY is not set. Payments will not function without it.",
          );
        }

        return new PaystackProvider(secretKey, baseUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService, PayoutsService],
})
export class PaymentsModule {}
