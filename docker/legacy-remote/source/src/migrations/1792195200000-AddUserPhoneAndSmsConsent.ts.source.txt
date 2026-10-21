import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive schema only. Legacy accounts remain valid with NULL phone. */
export class AddUserPhoneAndSmsConsent1792195200000 implements MigrationInterface {
  name = 'AddUserPhoneAndSmsConsent1792195200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."users"
      ADD COLUMN "phone_e164" varchar(16),
      ADD COLUMN "phone_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN "phone_verified_at" timestamptz,
      ADD CONSTRAINT "CK_users_phone_e164" CHECK
        ("phone_e164" IS NULL OR "phone_e164" ~ '^\\+[1-9][0-9]{1,14}$'),
      ADD CONSTRAINT "CK_users_phone_verification" CHECK
        ((NOT "phone_verified" AND "phone_verified_at" IS NULL) OR
         ("phone_verified" AND "phone_e164" IS NOT NULL AND "phone_verified_at" IS NOT NULL))`);
    await queryRunner.query(`ALTER TABLE "public"."marketing_preferences"
      ADD COLUMN "smsMarketing" boolean NOT NULL DEFAULT false,
      ADD COLUMN "smsMarketingGrantedAt" timestamptz,
      ADD COLUMN "smsMarketingRevokedAt" timestamptz,
      ADD COLUMN "smsMarketingConsentVersion" varchar(64),
      ADD CONSTRAINT "CK_marketing_sms_consent" CHECK (
        ("smsMarketingGrantedAt" IS NULL AND "smsMarketingRevokedAt" IS NULL AND
         "smsMarketingConsentVersion" IS NULL AND NOT "smsMarketing") OR
        ("smsMarketingGrantedAt" IS NOT NULL AND "smsMarketingConsentVersion" IS NOT NULL AND
         length("smsMarketingConsentVersion") > 0 AND
         (("smsMarketing" AND "smsMarketingRevokedAt" IS NULL) OR
          (NOT "smsMarketing" AND "smsMarketingRevokedAt" IS NOT NULL AND
           "smsMarketingRevokedAt" >= "smsMarketingGrantedAt"))))`);
    // Deliberately no UNIQUE phone constraint: unverified duplicates are allowed.
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Explicit rollback loses phone/consent data; requires separate authorization.
    await queryRunner.query(`ALTER TABLE "public"."marketing_preferences"
      DROP CONSTRAINT "CK_marketing_sms_consent",
      DROP COLUMN "smsMarketingConsentVersion", DROP COLUMN "smsMarketingRevokedAt",
      DROP COLUMN "smsMarketingGrantedAt", DROP COLUMN "smsMarketing"`);
    await queryRunner.query(`ALTER TABLE "public"."users"
      DROP CONSTRAINT "CK_users_phone_verification", DROP CONSTRAINT "CK_users_phone_e164",
      DROP COLUMN "phone_verified_at", DROP COLUMN "phone_verified", DROP COLUMN "phone_e164"`);
  }
}
