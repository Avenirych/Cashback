import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  reporter: User;

  @ManyToOne(() => User)
  target: User;

  @Column()
  reason: string;

  @Column({ default: 'pending' })
  status: string; // pending | reviewed | rejected

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
