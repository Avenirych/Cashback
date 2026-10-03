import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  getAll() {
    return this.topicsService.getAll();
  }

  @Post()
  create(@Body() body: { title: string; content: string; authorId: number }) {
    return this.topicsService.create(body);
  }

  @Get(':id')
  getOne(@Param('id') id: number) {
    return this.topicsService.getOne(id);
  }
}
