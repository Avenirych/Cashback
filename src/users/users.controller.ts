import { Controller, Get, Post, Param, Body } from '@nestjs/common';
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

  @Post(':id/balance')
  updateBalance(@Param('id') id: number, @Body('amount') amount: number) {
    return this.usersService.updateBalance(id, amount);
  }
}
