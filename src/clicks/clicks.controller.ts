import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { ClicksService } from './clicks.service';
import { ProductsService } from '../products/products.service';

@Controller('clicks')
export class ClicksController {
  constructor(
    private readonly clicksService: ClicksService,
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  async registerClick(@Body() body: { offerId: number }) {
    const offer = await this.productsService.getOfferById(body.offerId);

    if (!offer) {
      throw new NotFoundException(`Offer with id ${body.offerId} not found`);
    }

    return this.clicksService.registerClick(offer);
  }
}
