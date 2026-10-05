import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Post } from '../posts.entity';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  email: string;
  @Column()
  name: string;
  @Column({ nullable: true })
  avatar_url: string;
  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
  })
  balance: number;
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;
  @OneToMany(
    () => Post,
    (post) => post.author,
  )
  posts: Post[];
}

