import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Seller } from '../sellers/seller.entity';

@Entity('seller_rating')
export class SellerRating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Seller, seller => seller.rating)
  seller: Seller;

  @Column({ type: 'float', default: 5 })
  rating: number;

  @Column({ default: 0 })
  total_reports: number;

  @Column({ default: 0 })
  total_positive: number;

  @Column({ default: 0 })
  total_negative: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
