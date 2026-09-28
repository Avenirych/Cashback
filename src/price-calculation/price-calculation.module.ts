import { Module } from '@nestjs/common';
import { PriceCalculationService } from './price-calculation.service';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [BonusModule],
  providers: [PriceCalculationService],
  exports: [PriceCalculationService],
})
export class PriceCalculationModule {}
