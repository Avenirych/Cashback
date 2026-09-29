import { Controller, Get, Param, Post } from '@nestjs/common';
import { SellerRatingService } from './seller-rating.service';

@Controller('seller-rating')
export class SellerRatingController {
  constructor(private readonly ratingService: SellerRatingService) {}

  @Get(':sellerId')
  getRating(@Param('sellerId') sellerId: number) {
    return this.ratingService.getSellerRating(sellerId);
  }

  @Post(':sellerId/positive')
  addPositive(@Param('sellerId') sellerId: number) {
    return this.ratingService.addPositive(sellerId);
  }

  @Post(':sellerId/negative')
  addNegative(@Param('sellerId') sellerId: number) {
    return this.ratingService.addNegative(sellerId);
  }

  @Post(':sellerId/report')
  addReport(@Param('sellerId') sellerId: number) {
    return this.ratingService.addReport(sellerId);
  }
}
