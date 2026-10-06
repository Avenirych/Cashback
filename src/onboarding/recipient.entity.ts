import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('onboarding_recipients')
export class Recipient {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text')
  ciphertext: string;

  @Column('varchar')
  iv: string;

  @Column('varchar')
  authTag: string;

  @Column('timestamp')
  updatedAt: Date;
}
