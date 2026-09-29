import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SearchService {
  constructor(private readonly productsService: ProductsService) {}

  async search(query: string) {
    return this.productsService.searchProducts(query);
  }
}
