import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('withdrawals')
@Index(['user', 'requestId'], { unique: true })
export class Withdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number | string;

  @Column({ type: 'uuid', nullable: true })
  requestId: string;

  @Column({ nullable: true })
  recipientId: number;

  @Column({ default: 'GBP' })
  currency: string;

  @Column({ default: 'pending' })
  status: string; // pending | approved | rejected

  @Column({ nullable: true })
  method: string; // PayPal, Bank Transfer, Revolut, etc.

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
