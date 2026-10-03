import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PostsService {
  private pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  async create(data: { topicId: number; content: string; authorId: number }) {
    const res = await this.pool.query(
      'INSERT INTO posts (topic_id, content, author_id) VALUES ($1, $2, $3) RETURNING *',
      [data.topicId, data.content, data.authorId]
    );
    return res.rows[0];
  }
}
