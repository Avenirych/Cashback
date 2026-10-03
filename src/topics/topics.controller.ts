import { Controller, Get } from '@nestjs/common';

@Controller('topics')
export class TopicsController {
  @Get()
  getTopics() {
    return [
      { id: 1, title: 'Welcome to Cashback+' },
      { id: 2, title: 'Bug reports' },
      { id: 3, title: 'Feature requests' },
    ];
  }
}