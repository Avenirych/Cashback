import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('programme_memberships')
export class ProgrammeMembership {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  programmeOptIn: boolean;

  @Column({ default: false })
  privacyAcknowledged: boolean;

  @Column({ default: false })
  accuracyConfirmed: boolean;

  @Column('varchar')
  noticeVersion: string;

  @Column('varchar')
  termsVersion: string;

  @Column('timestamp')
  optedInAt: Date;

  @Column('timestamp')
  privacyAcknowledgedAt: Date;

  @Column('timestamp')
  accuracyConfirmedAt: Date;

  @Column('timestamp')
  completedAt: Date;
}
