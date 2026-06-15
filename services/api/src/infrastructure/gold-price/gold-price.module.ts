import { Global, Module } from '@nestjs/common';
import { GoldPriceService } from './gold-price.service';

@Global()
@Module({
  providers: [GoldPriceService],
  exports: [GoldPriceService],
})
export class GoldPriceModule {}
