import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('report')
  createReport(@Req() req: Request, @Body() body: any) {
    const user = req.user as { id: number } | undefined;
    if (!user) throw new Error('User not found');

    return this.moderationService.createReport(
      user.id,
      body.targetId,
      body.reason,
    );
  }

  @Get('reports')
  getReports() {
    return this.moderationService.getReports();
  }

  @Post('report/:id/status')
  updateStatus(@Param('id') id: number, @Body() body: any) {
    return this.moderationService.updateStatus(id, body.status);
  }
}
