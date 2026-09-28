import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';

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

  // ---------------------------------------------------------
  // Получить все товары
  // ---------------------------------------------------------
  getProducts() {
    return this.productRepo.find({
      relations: {
        offers: true,
      },
    });
  }

  // ---------------------------------------------------------
  // Получить товар по ID
  // ---------------------------------------------------------
  getProduct(id: number) {
    return this.productRepo.findOne({
      where: { id },
      relations: {
        offers: true,
      },
    });
  }

  // ---------------------------------------------------------
  // Создать товар
  // ---------------------------------------------------------
  async createProduct(data: Partial<Product>) {
    const product = this.productRepo.create(data);
    return this.productRepo.save(product);
  }

  // ---------------------------------------------------------
  // Добавить оффер к товару
  // ---------------------------------------------------------
  async addOffer(productId: number, data: Partial<Offer>) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const offer = this.offerRepo.create({
      ...data,
      product,
    });

    return this.offerRepo.save(offer);
  }

  // ---------------------------------------------------------
  // Получить оффер по ID (нужно для ClicksModule и TransactionModule)
  // ---------------------------------------------------------
  getOfferById(id: number) {
    return this.offerRepo.findOne({
      where: { id },
      relations: {
        product: true,
        seller: true,
      },
    });
  }

  // ---------------------------------------------------------
  // Поиск товаров по названию, бренду, категории
  // ---------------------------------------------------------
  searchProducts(query: string) {
    return this.productRepo.find({
      where: [
        { title: Like(`%${query}%`) },
        { brand: Like(`%${query}%`) },
        { category: Like(`%${query}%`) },
      ],
      relations: {
        offers: true,
      },
    });
  }
}
