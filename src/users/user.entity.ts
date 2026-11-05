import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'first_name', nullable: true, select: false })
  firstName: string | null;

  @Column({ type: 'varchar', name: 'last_name', nullable: true, select: false })
  lastName: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  phone_e164: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'integer', name: 'session_version', default: 0, select: false })
  sessionVersion: number;

  @Column({type:'bytea',name:'password_reset_digest',nullable:true,select:false})
  passwordResetDigest: Buffer | null;

  @Column({type:'timestamptz',name:'password_reset_expires_at',nullable:true,select:false})
  passwordResetExpiresAt: Date | null;

  @Column({type:'integer',name:'password_reset_session_version',nullable:true,select:false})
  passwordResetSessionVersion: number | null;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  email_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  email_token_expires_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}