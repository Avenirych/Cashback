import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerRating } from './seller-rating.entity';
import { SellerRatingService } from './seller-rating.service';
import { SellerRatingController } from './seller-rating.controller';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SellerRating]),
    SellersModule,
  ],
  providers: [SellerRatingService],
  controllers: [SellerRatingController],
  exports: [SellerRatingService],
})
export class SellerRatingModule {}
