import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post(':userId')
  send(
    @Param('userId') userId: number,
    @Body('type') type: string,
    @Body('title') title: string,
    @Body('message') message: string,
  ) {
    return this.notificationsService.send(userId, type, title, message);
  }

  @Get(':userId')
  getUserNotifications(@Param('userId') userId: number) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post('read/:id')
  markAsRead(@Param('id') id: number) {
    return this.notificationsService.markAsRead(id);
  }
}
