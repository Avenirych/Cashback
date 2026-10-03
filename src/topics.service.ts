import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class TopicsService {
  private pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  async getAll() {
    const res = await this.pool.query('SELECT * FROM topics ORDER BY created_at DESC');
    return res.rows;
  }

  async create(data: { title: string; content: string; authorId: number }) {
    const res = await this.pool.query(
      'INSERT INTO topics (title, content, author_id) VALUES ($1, $2, $3) RETURNING *',
      [data.title, data.content, data.authorId]
    );
    return res.rows[0];
  }

  async getOne(id: number) {
    const topic = await this.pool.query('SELECT * FROM topics WHERE id=$1', [id]);
    const posts = await this.pool.query('SELECT * FROM posts WHERE topic_id=$1 ORDER BY created_at ASC', [id]);

    return {
      topic: topic.rows[0],
      posts: posts.rows,
    };
  }
}
