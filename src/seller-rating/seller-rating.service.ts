import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerRating } from './seller-rating.entity';

@Injectable()
export class SellerRatingService {
  constructor(
    @InjectRepository(SellerRating)
    private readonly ratingRepo: Repository<SellerRating>,
  ) {}

  async getSellerRating(sellerId: number) {
    let rating = await this.ratingRepo.findOne({
      where: { seller: { id: sellerId } },
    });

    if (!rating) {
      rating = this.ratingRepo.create({
        seller: { id: sellerId } as any,
        rating: 5,
        total_reports: 0,
        total_positive: 0,
        total_negative: 0,
      });

      await this.ratingRepo.save(rating);
    }

    return rating;
  }

  async addPositive(sellerId: number) {
    const rating = await this.getSellerRating(sellerId);

    rating.total_positive += 1;
    rating.rating = this.calculateRating(rating);

    return this.ratingRepo.save(rating);
  }

  async addNegative(sellerId: number) {
    const rating = await this.getSellerRating(sellerId);

    rating.total_negative += 1;
    rating.total_reports += 1;
    rating.rating = this.calculateRating(rating);

    return this.ratingRepo.save(rating);
  }

  async addReport(sellerId: number) {
    const rating = await this.getSellerRating(sellerId);

    rating.total_reports += 1;
    rating.rating = this.calculateRating(rating);

    return this.ratingRepo.save(rating);
  }

  private calculateRating(r: SellerRating): number {
    const base = 5;

    const penalty = r.total_negative * 0.3;
    const bonus = r.total_positive * 0.1;

    let final = base + bonus - penalty;

    if (final < 1) final = 1;
    if (final > 5) final = 5;

    return Number(final.toFixed(2));
  }
}
