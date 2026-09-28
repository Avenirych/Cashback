import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sellers')
export class Seller {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Amazon, eBay, AliExpress

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  website_url: string;

  @Column({ nullable: true })
  api_source: string; // amazon_api / awin / cj / admitad / manual
}
