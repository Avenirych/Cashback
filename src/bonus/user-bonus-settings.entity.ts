import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_bonus_settings')
export class UserBonusSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  ad_bonus_percent: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  research_bonus_percent: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
