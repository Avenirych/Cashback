import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { Offer } from '../products/offer.entity';
import { Seller } from '../partners/seller.entity';
import { Click } from '../clicks/click.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Click)
  click: Click;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Offer)
  offer: Offer;

  @ManyToOne(() => Seller)
  seller: Seller;

  @Column('decimal', { precision: 10, scale: 2 })
  order_amount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  commission_received: number;

  @Column('decimal', { precision: 10, scale: 2 })
  cashback_amount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  ad_bonus_amount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  research_bonus_amount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  final_price: number;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
