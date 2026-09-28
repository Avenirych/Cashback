import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: number; // сумма кешбэка

  @Column()
  description: string; // описание операции

  @ManyToOne(() => User, user => user.id)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
