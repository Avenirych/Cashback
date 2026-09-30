import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Click } from '../clicks/click.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Click, { nullable: true })
  click: Click | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
