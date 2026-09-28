import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { Offer } from '../products/offer.entity';
import { Seller } from '../partners/seller.entity';

@Entity('clicks')
export class Click {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Offer)
  offer: Offer;

  @ManyToOne(() => Seller)
  seller: Seller;

  @Column()
  click_id: string; // токен для партнёрской сети

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  clicked_at: Date;
}
