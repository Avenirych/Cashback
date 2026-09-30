import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Product } from './product.entity';
import { Seller } from '../partners/seller.entity';

@Entity()
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  price: number;

  @Column()
  cashback: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  cashback_rate_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  seller_discount: number;

  @ManyToOne(() => Product, product => product.offers)
  product: Product;

  @ManyToOne(() => Seller, seller => seller.offers)
  seller: Seller;
}
