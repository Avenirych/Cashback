import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('balance_operations')
export class BalanceOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  type: string; // 'cashback', 'bonus', 'withdraw', 'freeze', 'unfreeze'

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number | string;

  @Column({ default: 'pending' })
  status: string; // pending | confirmed | reversed

  @Column({ default: 'GBP' })
  currency: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
