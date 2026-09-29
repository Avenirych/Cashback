import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Offer } from '../products/offer.entity';
import { Seller } from '../partners/seller.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: number;

  @ManyToOne(() => Offer)
  offer: Offer;

  @ManyToOne(() => Seller)
  seller: Seller;
}
