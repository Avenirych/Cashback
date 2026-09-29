import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
  ) {}

  async createReport(reporterId: number, targetId: number, reason: string) {
    const report = this.reportRepo.create({
      reporter: { id: reporterId } as any,
      target: { id: targetId } as any,
      reason,
      status: 'pending',
    });

    return this.reportRepo.save(report);
  }

  async getReports() {
    return this.reportRepo.find({
      relations: { reporter: true, target: true },
      order: { created_at: 'DESC' },
    });
  }

  async updateStatus(reportId: number, status: string) {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    report.status = status;
    return this.reportRepo.save(report);
  }
}
