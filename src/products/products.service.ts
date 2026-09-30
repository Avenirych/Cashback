import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { Offer } from './offer.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
  ) {}

  async getAll(sort?: string) {
    return this.productRepo.find({
      order: { name: sort === 'asc' ? 'ASC' : 'DESC' },
      relations: { offers: true, seller: true },
    });
  }

  async compareProducts(id1: number, id2: number) {
    const p1 = await this.productRepo.findOne({
      where: { id: id1 },
      relations: { offers: true, seller: true },
    });

    const p2 = await this.productRepo.findOne({
      where: { id: id2 },
      relations: { offers: true, seller: true },
    });

    return { product1: p1, product2: p2 };
  }

  async getTopDayBestOffers() {
    return this.offerRepo.find({
      order: { cashback_rate_percent: 'DESC' },
      take: 10,
      relations: { product: true, seller: true },
    });
  }

  async getTopMonthBestOffers() {
    return this.getTopDayBestOffers();
  }

  async getTopYearBestOffers() {
    return this.getTopDayBestOffers();
  }

  async getTopFavorites(ids: number[]) {
    return this.productRepo.find({
      where: ids.map(id => ({ id })),
      relations: { offers: true, seller: true },
    });
  }

  async getTopBrandBestOffers(brand: string) {
    return this.productRepo.find({
      where: { category: brand },
      relations: { offers: true, seller: true },
    });
  }

  async getTopSellerBestOffers(sellerId: number) {
    return this.productRepo.find({
      where: { seller: { id: sellerId } },
      relations: { offers: true, seller: true },
    });
  }
}
