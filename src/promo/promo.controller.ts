import { NonFinancialMutation } from '../financial-write-deny';
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PromoService } from './promo.service';

@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Get()
  getActivePromos() {
    return this.promoService.getActivePromos();
  }

  @Get(':code')
  getPromo(@Param('code') code: string) {
    return this.promoService.getPromoByCode(code);
  }

  @NonFinancialMutation()
  @Post()
  createPromo(@Body() body: any) {
    return this.promoService.createPromo(body);
  }
}
