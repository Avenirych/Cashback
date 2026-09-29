import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ default: true })
  bonus_enabled: boolean;

  @Column({ default: true })
  notify_cashback: boolean;

  @Column({ default: true })
  notify_bonus: boolean;

  @Column({ default: true })
  notify_forum_replies: boolean;

  @Column({ default: true })
  notify_new_offers: boolean;

  @Column({ default: 'light' })
  theme: string;

  @Column({ default: 'GBP' })
  currency: string;

  @Column({ default: 'en' })
  language: string;

  @Column('simple-array', { nullable: true })
  favorite_sellers: number[];

  @Column('simple-array', { nullable: true })
  blocked_sellers: number[];
}
