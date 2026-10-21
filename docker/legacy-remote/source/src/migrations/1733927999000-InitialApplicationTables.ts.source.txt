import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Fresh databases only. Historical migrations own email fields and four tables. */
export class InitialApplicationTables1733927999000 implements MigrationInterface {
  name = 'InitialApplicationTables1733927999000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Fail on existing tables rather than silently accepting a partial schema.
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "email" varchar NOT NULL,
        "name" varchar NOT NULL,
        "avatar_url" varchar,
        "password" varchar,
        "balance" numeric(10,2) NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" SERIAL PRIMARY KEY,
        "type" varchar NOT NULL,
        "userId" integer,
        "data" text,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "topic" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "post" (
        "id" SERIAL PRIMARY KEY,
        "content" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "topicId" integer REFERENCES "topic"("id"),
        "authorId" integer REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "forum_topics" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar NOT NULL,
        "authorId" integer REFERENCES "users"("id"),
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "forum_posts" (
        "id" SERIAL PRIMARY KEY,
        "topicId" integer REFERENCES "forum_topics"("id"),
        "authorId" integer REFERENCES "users"("id"),
        "content" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Revert historical migrations first. No CASCADE or data-preserving claim.
    for (const table of [
      'forum_posts', 'forum_topics', 'post', 'topic', 'analytics_events', 'users',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
