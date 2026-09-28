import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promo } from './promo.entity';

@Injectable()
export class PromoService {
  constructor(
    @InjectRepository(Promo)
    private readonly promoRepo: Repository<Promo>,
  ) {}

  getActivePromos() {
    return this.promoRepo.find({ where: { active: true } });
  }

  getPromoByCode(code: string) {
    return this.promoRepo.findOne({ where: { code, active: true } });
  }

  createPromo(data: Partial<Promo>) {
    const promo = this.promoRepo.create(data);
    return this.promoRepo.save(promo);
  }
}
