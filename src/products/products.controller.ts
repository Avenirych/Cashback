import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PriceCalculationService } from '../price-calculation/price-calculation.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly priceService: PriceCalculationService,
  ) {}

  @Get(':id/comparison/:userId')
  async compareOffers(
    @Param('id') id: number,
    @Param('userId') userId: number,
  ) {
    const product = await this.productsService.getProduct(id);

    if (!product) {
      throw new Error('Product not found');
    }

    const results = [];

    for (const offer of product.offers) {
      const calc = await this.priceService.calculateFinalPrice(userId, offer);

      results.push({
        seller: offer.seller?.name || 'Unknown seller',
        ...calc,
      });
    }

    results.sort((a, b) => a.final_price - b.final_price);

    return {
      product: product.title,
      best_offer: results[0],
      offers: results,
    };
  }
}
