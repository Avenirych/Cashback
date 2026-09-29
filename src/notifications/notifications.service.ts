import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './notification.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly usersService: UsersService,
  ) {}

  async send(userId: number, type: string, title: string, message: string) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new Error('User not found');

    const notif = this.notifRepo.create({
      user,
      type,
      title,
      message,
    });

    return this.notifRepo.save(notif);
  }

  getUserNotifications(userId: number) {
    return this.notifRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async markAsRead(id: number) {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new Error('Notification not found');

    notif.read = true;
    return this.notifRepo.save(notif);
  }
}
