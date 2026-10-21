import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Requires a separately approved duplicate/canonical-email preflight. */
export class AddUsersEmailUnique1791888000000 implements MigrationInterface {
  name = 'AddUsersEmailUnique1791888000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Exact stored-value uniqueness. Application normalization remains unchanged.
    // Fail on duplicates or schema drift; do not repair or rewrite user data.
    await queryRunner.query(
      'ALTER TABLE "public"."users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "public"."users" DROP CONSTRAINT "UQ_users_email"',
    );
  }
}
