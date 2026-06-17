import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MintController } from "./mint.controller";
import { MintService } from "./mint.service";
import { MintConfirmatorService } from "./mint-confirmator.service";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [ScheduleModule.forFeature(), OrdersModule],
  controllers: [MintController],
  providers: [MintService, MintConfirmatorService],
  exports: [MintService],
})
export class MintModule {}
