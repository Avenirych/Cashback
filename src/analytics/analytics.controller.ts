import { Controller, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Internal service functionality remains; no unapproved public analytics route.
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
