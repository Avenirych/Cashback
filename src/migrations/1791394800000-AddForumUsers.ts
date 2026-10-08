import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumUsers1791394800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Migrations precede synchronization; a fresh dev database has no users yet.
    if (
      queryRunner.connection.options.synchronize &&
      !(await queryRunner.hasTable('users'))
    ) {
      return;
    }
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_users" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL UNIQUE,
        "username" varchar(30) NOT NULL UNIQUE,
        "avatar_url" varchar,
        "agreed_to_rules" boolean NOT NULL DEFAULT false,
        "agreed_to_rules_at" timestamp,
        "banned" boolean NOT NULL DEFAULT false,
        "ban_reason" text,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_forum_users_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "forum_users"');
  }
}
