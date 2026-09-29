import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  getAll() {
    return this.sellersService.getAll();
  }

  @Get(':id')
  getSeller(@Param('id') id: number) {
    return this.sellersService.getSeller(id);
  }

  @Post()
  createSeller(@Body() body: any) {
    return this.sellersService.createSeller(body);
  }
}
