import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('marketing_preferences')
export class MarketingPreferences {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ default: true })
  accountUpdates: boolean;

  @Column({ default: false })
  specialOffers: boolean;

  @Column({ default: false })
  partnerRecommendations: boolean;

  @Column({ default: false })
  smsMarketing: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  smsMarketingGrantedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  smsMarketingRevokedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  smsMarketingConsentVersion: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
