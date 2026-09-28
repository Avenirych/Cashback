import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seller } from './seller.entity';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellerRepo: Repository<Seller>,
  ) {}

  getSellers() {
    return this.sellerRepo.find();
  }

  getSeller(id: number) {
    return this.sellerRepo.findOne({ where: { id } });
  }

  async addSeller(data: Partial<Seller>) {
    const seller = this.sellerRepo.create(data);
    return this.sellerRepo.save(seller);
  }
}
