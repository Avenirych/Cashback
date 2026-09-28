import { Controller, Post, Param } from '@nestjs/common';
import { ClicksService } from './clicks.service';
import { ProductsService } from '../products/products.service';

@Controller('clicks')
export class ClicksController {
  constructor(
    private readonly clicksService: ClicksService,
    private readonly productsService: ProductsService,
  ) {}

  @Post(':userId/offer/:offerId')
  async clickOffer(
    @Param('userId') userId: number,
    @Param('offerId') offerId: number,
  ) {
    const offer = await this.productsService.getOfferById(offerId);

    if (!offer) {
      throw new Error('Offer not found');
    }

    const result = await this.clicksService.registerClick(userId, offer);

    return result;
  }
}
