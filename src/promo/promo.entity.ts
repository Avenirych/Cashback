import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('promo_discounts')
export class Promo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string; // промокод

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount_amount: number; // скидка в £

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discount_percent: number; // скидка в %

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
