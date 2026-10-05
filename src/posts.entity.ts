import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Topic } from './topics.entity';
import { User } from './users/user.entity';
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;
  @Column('text')
  content: string;
  @CreateDateColumn()
  createdAt: Date;
  @ManyToOne(
    () => Topic,
    (topic) => topic.posts,
  )
  topic: Topic;
  @ManyToOne(() => User)
  author: User;
}

