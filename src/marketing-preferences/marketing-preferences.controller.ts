import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketingPreferencesService } from './marketing-preferences.service';

@Controller('user/marketing-preferences')
@UseGuards(JwtAuthGuard)
export class MarketingPreferencesController {
  constructor(
    private readonly service: MarketingPreferencesService,
  ) {}

  @Get()
  async getPreferences(@Request() req: any) {
    const userId = req.user.id;
    return this.service.getPreferences(userId);
  }

  @Post()
  async updatePreferences(
    @Request() req: any,
    @Body()
    dto: {
      specialOffers?: boolean;
      partnerRecommendations?: boolean;
    },
  ) {
    const userId = req.user.id;
    return this.service.updatePreferences(userId, dto);
  }
}