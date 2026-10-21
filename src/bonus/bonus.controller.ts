import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusService } from './bonus.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: number;
  };
};

interface TransferBody {
  toUsername?: unknown;
  bonusIds?: unknown;
}

@Controller('api/bonus')
@UseGuards(JwtAuthGuard)
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  private userId(req: AuthenticatedRequest): number {
    const id = req.user?.id;

    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw new BadRequestException('Invalid authenticated user');
    }

    return id;
  }

  @Get('snapshot')
  getSnapshot(@Req() req: AuthenticatedRequest) {
    return this.bonusService.getSnapshot(this.userId(req));
  }

  @Post('transfer')
  async transfer(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: TransferBody,
  ) {
    const userId = this.userId(req);

    if (
      !body ||
      typeof body.toUsername !== 'string' ||
      !Array.isArray(body.bonusIds) ||
      !body.bonusIds.every((id): id is string => typeof id === 'string')
    ) {
      throw new BadRequestException(
        'toUsername and bonusIds are required',
      );
    }

    if (typeof key !== 'string') {
      throw new BadRequestException('Idempotency-Key is required');
    }

    const entries = await this.bonusService.transferBonuses(
      userId,
      body.toUsername,
      body.bonusIds,
      key,
    );

    return entries.map((entry) =>
      this.bonusService.serializeTransfer(entry),
    );
  }

  @Post('spend-on-purchase')
  spend(@Req() req: AuthenticatedRequest) {
    this.userId(req);
    return this.bonusService.spendBonusesOnPurchase();
  }
}