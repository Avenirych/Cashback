import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product } from './product.entity';
import { Offer } from './offer.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,

    @InjectRepository(Offer)
    private readonly offersRepository: Repository<Offer>,
  ) {}

  async getBestOfferById(id: number): Promise<Offer | null> {
    return this.offersRepository.findOne({
      where: { id },
      relations: {
        product: true,
        seller: true,
      },
    });
  }

  async getOfferById(id: number): Promise<Offer | null> {
    return this.getBestOfferById(id);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { name: ILike(`%${query}%`) },
      relations: {
        offers: true,
      },
    });
  }
}
