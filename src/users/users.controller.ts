import { Controller, Get, Post, Param, Body, Patch } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAll() {
    return this.usersService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: number) {
    return this.usersService.getById(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Post(':id/balance')
  updateBalance(@Param('id') id: number, @Body('amount') amount: number) {
    return this.usersService.updateBalance(id, amount);
  }
}
