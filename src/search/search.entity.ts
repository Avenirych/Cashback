import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('search_logs')
export class SearchLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  query: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  searched_at: Date;
}
