import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar_url: string | null;

  @Column({ nullable: true })
  password: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
