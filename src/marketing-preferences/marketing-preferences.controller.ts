import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketingPreferencesService } from './marketing-preferences.service';
import { parseMarketingPreferences } from './marketing-preferences.dto';
interface PreferencesRequest { user: { id: number } }

@Controller('user/marketing-preferences')
@UseGuards(JwtAuthGuard)
export class MarketingPreferencesController {
  constructor(private readonly service: MarketingPreferencesService) {}

  @Get()
  getPreferences(@Req() req: PreferencesRequest) {
    return this.service.getPreferences(req.user.id);
  }

  @Post()
  updatePreferences(@Req() req: PreferencesRequest, @Body() body: unknown) {
    return this.service.updatePreferences(req.user.id, parseMarketingPreferences(body));
  }
}
