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

@Entity('bonus_transfers')
@Index('IDX_bonus_transfers_sender', ['fromUserId', 'createdAt'])
@Index('IDX_bonus_transfers_receiver', ['toUserId', 'createdAt'])
export class BonusTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  fromUserId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'fromUserId' })
  fromUser: User;

  @Column({ type: 'int' })
  toUserId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'toUserId' })
  toUser: User;

  @Column({ type: 'varchar', length: 30 })
  fromUsername: string;

  @Column({ type: 'varchar', length: 30 })
  toUsername: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: 'completed';

  @Column({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ type: 'uuid' })
  sourceBonusId: string;
}