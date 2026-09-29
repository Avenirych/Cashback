import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ForumTopic } from './forum-topic.entity';
import { User } from '../users/user.entity';

@Entity('forum_posts')
export class ForumPost {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForumTopic)
  topic: ForumTopic;

  @ManyToOne(() => User)
  author: User;

  @Column()
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
