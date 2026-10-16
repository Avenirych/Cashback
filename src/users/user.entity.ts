import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  name: string;

  // Private by default: only owner-profile queries explicitly select these.
  @Column({ type: 'varchar', length: 16, nullable: true, select: false })
  phone_e164: string | null;

  @Column({ type: 'boolean', default: false, select: false })
  phone_verified: boolean;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  phone_verified_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  email_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  email_token_expires_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
