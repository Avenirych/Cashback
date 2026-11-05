import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Prepared only: execute solely through a separately approved staging migration procedure. */
export class AddSessionVersion1793836800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // No IF NOT EXISTS: an unexpected pre-existing column must fail for review.
    await queryRunner.query(`
      ALTER TABLE "public"."users"
        ADD COLUMN "session_version" integer NOT NULL DEFAULT 0
        CONSTRAINT "CK_users_session_version_nonnegative" CHECK ("session_version" >= 0)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Dropping/resetting versions can resurrect revoked JWTs. Never infer safe rollback.
    throw new Error('SESSION_VERSION_ROLLBACK_REQUIRES_SEPARATE_REVIEW');
  }
}
