import { Controller, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

// Legacy HTTP handlers are unregistered pending an approved authorization model.
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}
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
