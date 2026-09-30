import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics.entity';

export interface EventFilter {
  userId?: number;
  type?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  async getEvents(filters: EventFilter) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.type) where.type = filters.type;

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}
