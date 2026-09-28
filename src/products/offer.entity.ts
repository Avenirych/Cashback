import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Product } from './product.entity';
import { Seller } from '../partners/seller.entity';

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, product => product.offers)
  product: Product;

  @ManyToOne(() => Seller)
  seller: Seller;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  seller_discount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  cashback_rate_percent: number;

  @Column({ nullable: true })
  affiliate_link: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_update: Date;
}
