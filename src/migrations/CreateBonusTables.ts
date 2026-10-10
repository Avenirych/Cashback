import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBonusTables1791630000000
  implements MigrationInterface
{
  name = 'CreateBonusTables1791630000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // check tables only once
    const hasBonusItems = await queryRunner.hasTable('bonus_items');
    const hasBonusTransfers = await queryRunner.hasTable('bonus_transfers');

    if (hasBonusItems || hasBonusTransfers) {
      return;
    }

    await queryRunner.query(`
      CREATE TYPE bonus_items_source_enum AS ENUM
        ('ads', 'research', 'transfer', 'purchase', 'refund')
    `);

    await queryRunner.query(`
      CREATE TYPE bonus_items_status_enum AS ENUM
        ('pending', 'confirmed', 'spent', 'expired', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE bonus_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL REFERENCES users(id),
        source bonus_items_source_enum NOT NULL,
        amount numeric(12, 2) NOT NULL CHECK (amount > 0),
        status bonus_items_status_enum NOT NULL DEFAULT 'confirmed',
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "referenceId" varchar(100),
        "orderId" varchar(100),
        "transferMeta" jsonb
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bonus_items_available"
      ON bonus_items ("userId", status, "expiresAt")
    `);

    await queryRunner.query(`
      CREATE TABLE bonus_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "fromUserId" integer NOT NULL REFERENCES users(id),
        "toUserId" integer NOT NULL REFERENCES users(id),
        "fromUsername" varchar(30) NOT NULL,
        "toUsername" varchar(30) NOT NULL,
        amount numeric(12, 2) NOT NULL CHECK (amount > 0),
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status varchar(20) NOT NULL DEFAULT 'completed',
        "idempotencyKey" varchar(100) NOT NULL,
        "requestHash" varchar(64) NOT NULL,
        "sourceBonusId" uuid NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bonus_transfers_sender"
      ON bonus_transfers ("fromUserId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bonus_transfers_receiver"
      ON bonus_transfers ("toUserId", "createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS bonus_transfers');
    await queryRunner.query('DROP TABLE IF EXISTS bonus_items');
    await queryRunner.query('DROP TYPE IF EXISTS bonus_items_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS bonus_items_source_enum');
  }
}