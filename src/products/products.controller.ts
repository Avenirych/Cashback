import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getAll(@Query('sort') sort?: string) {
    return this.productsService.getAll(sort);
  }

  @Get(':id/best-offer')
  getBestOffer(@Param('id') id: string) {
    return this.productsService.getBestOfferById(+id);
  }

  @Get('compare')
  compare(@Query('id1') id1: string, @Query('id2') id2: string) {
    return this.productsService.compareProducts(+id1, +id2);
  }

  @Get('compare/table')
  compareTable(@Query('id1') id1: string, @Query('id2') id2: string) {
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
  getTopFavorites(@Query('ids') ids: string) {
    const arr = ids.split(',').map(Number);
    return this.productsService.getTopFavorites(arr);
  }

  @Get('top/brand/:brand')
  getTopBrand(@Param('brand') brand: string) {
    return this.productsService.getTopBrandBestOffers(brand);
  }

  @Get('top/seller/:sellerId')
  getTopSeller(@Param('sellerId') sellerId: string) {
    return this.productsService.getTopSellerBestOffers(+sellerId);
  }
}
