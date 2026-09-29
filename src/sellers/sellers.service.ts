import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seller } from './seller.entity';

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellerRepo: Repository<Seller>,
  ) {}

  async getSeller(id: number) {
    return this.sellerRepo.findOne({ where: { id } });
  }

  async getAll() {
    return this.sellerRepo.find();
  }

  async createSeller(data: Partial<Seller>) {
    const seller = this.sellerRepo.create(data);
    return this.sellerRepo.save(seller);
  }

  async deactivateSeller(id: number) {
    const seller = await this.getSeller(id);
    if (!seller) throw new Error('Seller not found');

    seller.is_active = false;
    return this.sellerRepo.save(seller);
  }
}
