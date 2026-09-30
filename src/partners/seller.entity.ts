import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Offer } from '../products/offer.entity';
import { Product } from '../products/product.entity';

@Entity()
export class Seller {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  rating: number;

  @Column()
  logoUrl: string;

  @OneToMany(() => Offer, offer => offer.seller)
  offers: Offer[];

  @OneToMany(() => Product, product => product.seller)
  products: Product[];
}
