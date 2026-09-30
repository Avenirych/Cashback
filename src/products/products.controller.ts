import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getAll(@Query('sort') sort?: string) {
    return this.productsService.getAll(sort);
  }

  @Get('compare/:id1/:id2')
  compare(@Param('id1') id1: string, @Param('id2') id2: string) {
    return this.productsService.compareProducts(+id1, +id2);
  }

  @Get('top/day')
  getTopDay() {
    return this.productsService.getTopDayBestOffers();
  }

  @Get('top/month')
  getTopMonth() {
    return this.productsService.getTopMonthBestOffers();
  }

  @Get('top/year')
  getTopYear() {
    return this.productsService.getTopYearBestOffers();
  }

  @Get('top/favorites')
  getFavorites(@Query('ids') ids: string) {
    return this.productsService.getTopFavorites(
      ids.split(',').map(Number),
    );
  }

  @Get('top/brand/:brand')
  getBrand(@Param('brand') brand: string) {
    return this.productsService.getTopBrandBestOffers(brand);
  }

  @Get('top/seller/:sellerId')
  getSeller(@Param('sellerId') sellerId: string) {
    return this.productsService.getTopSellerBestOffers(+sellerId);
  }
}
