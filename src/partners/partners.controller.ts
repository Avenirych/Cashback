import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PartnersService } from './partners.service';

@Controller('sellers')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  getSellers() {
    return this.partnersService.getSellers();
  }

  @Get(':id')
  getSeller(@Param('id') id: number) {
    return this.partnersService.getSeller(id);
  }

  @Post()
  addSeller(@Body() body: any) {
    return this.partnersService.addSeller(body);
  }
}
