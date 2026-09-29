import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Offer } from '../products/offer.entity';
import { Seller } from '../partners/seller.entity';

@Entity()
export class Click {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  timestamp: Date;

  @ManyToOne(() => Offer)
  offer: Offer;

  @ManyToOne(() => Seller)
  seller: Seller;
}
