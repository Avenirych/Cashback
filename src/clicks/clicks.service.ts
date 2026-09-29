import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Click } from './click.entity';
import { Offer } from '../products/offer.entity';

@Injectable()
export class ClicksService {
  constructor(
    @InjectRepository(Click)
    private readonly clicksRepository: Repository<Click>,
  ) {}

  async registerClick(offer: Offer) {
    const click = this.clicksRepository.create({
      timestamp: new Date(),
      offer,
      seller: offer.seller,
    });

    return this.clicksRepository.save(click);
  }
}
