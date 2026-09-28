import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Offer } from './offer.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  brand: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  image_url: string;

  @OneToMany(() => Offer, offer => offer.product)
  offers: Offer[];
}
