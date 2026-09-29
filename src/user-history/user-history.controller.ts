import { Controller, Get, Param } from '@nestjs/common';
import { UserHistoryService } from './user-history.service';

@Controller('user-history')
export class UserHistoryController {
  constructor(private readonly historyService: UserHistoryService) {}

  @Get(':userId')
  getHistory(@Param('userId') userId: number) {
    return this.historyService.getUserHistory(userId);
  }
}
