import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type BonusSource =
  | 'ads'
  | 'research'
  | 'transfer'
  | 'purchase'
  | 'refund';

export type BonusStatus =
  | 'pending'
  | 'confirmed'
  | 'spent'
  | 'expired'
  | 'failed';

@Entity('bonus_items')
@Index('IDX_bonus_items_available', ['userId', 'status', 'expiresAt'])
export class BonusItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ['ads', 'research', 'transfer', 'purchase', 'refund'],
    enumName: 'bonus_items_source_enum',
  })
  source: BonusSource;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'spent', 'expired', 'failed'],
    enumName: 'bonus_items_status_enum',
    default: 'confirmed',
  })
  status: BonusStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  transferMeta: Record<string, any> | null;

  isExpired(now = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isAvailable(now = new Date()): boolean {
    return (
      this.status === 'confirmed' &&
      this.usedAt == null &&
      !this.isExpired(now)
    );
  }
}