import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_bonus_sources')
export class UserBonusSources {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  ad_earnings: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  research_referral_cashback: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
