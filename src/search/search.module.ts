import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchLog } from './search.entity';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchLog]),
    ProductsModule,
  ],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
