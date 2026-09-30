import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column({ nullable: true })
  userId: number;

  @Column({ type: 'text', nullable: true })
  data: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
