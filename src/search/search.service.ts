import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';

import { SearchLog } from './search.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(SearchLog)
    private readonly logRepo: Repository<SearchLog>,
    private readonly productsService: ProductsService,
  ) {}

  async search(query: string) {
    await this.logRepo.save({ query });

    return this.productsService.searchProducts(query);
  }
}
