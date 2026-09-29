import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { SellerRating } from '../seller-rating/seller-rating.entity';

@Entity('sellers')
export class Seller {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToOne(() => SellerRating, rating => rating.seller)
  rating: SellerRating;

  @OneToMany(() => Product, product => product.seller)
  products: Product[];
}
