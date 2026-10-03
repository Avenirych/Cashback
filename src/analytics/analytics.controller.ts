import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  async getEvents(
    @Query('userId') userId?: number,
    @Query('type') type?: string,
  ) {
    return this.analyticsService.getEvents({
      userId,
      type,
    });
  }
}