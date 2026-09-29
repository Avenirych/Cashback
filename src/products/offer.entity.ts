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

  @ManyToOne(() => Product, product => product.offers)
  product: Product;

  @ManyToOne(() => Seller)
  seller: Seller;
}
