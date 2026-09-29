import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly settingsService: UserSettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMySettings(@Req() req: Request) {
    const user = req.user as { id: number } | undefined;
    if (!user) throw new Error('User not found in request');
    return this.settingsService.getSettings(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  updateMySettings(@Req() req: Request, @Body() body: any) {
    const user = req.user as { id: number } | undefined;
    if (!user) throw new Error('User not found in request');
    return this.settingsService.updateSettings(user.id, body);
  }
}
