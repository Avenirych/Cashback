import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne } from 'typeorm';
import { Offer } from './offer.entity';
import { Seller } from '../partners/seller.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column()
  imageUrl: string;

  @ManyToOne(() => Seller, seller => seller.products, { nullable: true })
  seller: Seller;

  @OneToMany(() => Offer, offer => offer.product)
  offers: Offer[];
}
