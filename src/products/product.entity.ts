import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Offer } from './offer.entity';

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

  @OneToMany(() => Offer, offer => offer.product)
  offers: Offer[];
}
