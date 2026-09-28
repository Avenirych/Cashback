import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Seller } from './seller.entity';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Seller])],
  providers: [PartnersService],
  controllers: [PartnersController],
  exports: [PartnersService, TypeOrmModule],
})
export class PartnersModule {}
