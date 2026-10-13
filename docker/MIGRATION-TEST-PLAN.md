# Docker test migrations: history and current boundaries

This document records completed preparation and verification on 2026-10-13.
It does not authorize migration execution or describe a repeatable runbook for
existing databases. Runtime facts come from prior approved reports; no database
connection or Docker command was made during this documentation update.

## Main test database: six applied migrations

Database `cashback_docker_test`, OID 16384, role `cashback_test`, PostgreSQL 17.11,
cluster ID 7695793866029359141, volume `cashback-docker-test_postgres-test-data`.
The confirmed migration history is:

1. InitialApplicationTables1733927999000
2. AddMarketingPreferences1733928000000
3. AddEmailVerification1735000000000
4. AddForumUsers1791394800000
5. CreateBonusTables1791630000000
6. AddUsersEmailUnique1791888000000

`UQ_users_email` UNIQUE(email) and its backing index were confirmed. Application
records were cleaned after approved HTTP tests; all ten application tables were
empty. Migration history remains. Sequences were not reset.

## DataSource boundaries confirmed by code

| Configuration | Purpose and accepted database name |
| --- | --- |
| `src/docker-test-data-source.ts` | Fresh bootstrap verification: `cashback_docker_migration_check_<30 lowercase hex>` |
| `test/email-unique/data-source.ts` | Email-unique integration: `cashback_email_unique_it_<30 lowercase hex>` |
| `src/docker-main-test-data-source.ts` | Historical guarded first application to exactly `cashback_docker_test` |
| `src/data-source.ts` / AppModule | General CLI/runtime subsets; not the isolated full bootstrap configuration |

The first two configurations do not accept the main test database name. They
register all six migrations explicitly, with `synchronize=false`,
`migrationsRun=false` and transaction mode `all`. No root dotenv/DATABASE_URL/DB_*
fallback is used by the isolated configurations. The integration DataSource
requires an explicit execution gate and creation-receipt OID, then checks role,
IP, port, cluster, PostgreSQL major version and empty application objects before
writes. A matching name/OID does not alone prove fresh creation provenance.

The main guarded DataSource checks exact name, role, IP, cluster, OID 16384,
PostgreSQL 17, schema, five prior migrations, empty users and absence of email
uniqueness. It intentionally rejects today's six-migration state. Do not weaken
this guard or run it again to inspect/apply the already completed migration.
AppModule/general CLI also register the new migration but retain historical
subsets; InitialApplicationTables is not automatic production bootstrap.

## Historical bootstrap preparation

The initial five-migration plan created baseline users, analytics, topic/post and
forum tables, then marketing/email-verification/forum-user/bonus structures.
The initial migration is for new databases; existing tables cause failure.
It must not be added to an automatic production bootstrap.

Historical preparation included offline metadata/compiler checks and later real
PostgreSQL validation. The old five-pending-migration instructions, repeated
migration run, full revert/replay and database-creation steps are archived context,
not commands for today's main or retained integration database. **Do not execute
or repeat them without a separate target-specific plan and authorization.**
Schema/metadata differences in historical CHECK/UNIQUE constraints and names must
be reviewed before any generated schema diff; never apply an automatic diff that
removes protections. A zero schema diff is not claimed here.

## Separate email-unique integration database

The retained database is
`cashback_email_unique_it_a88eb0f355f948fadd76cebf0a4bc9`, OID 24577.
It is separate from the main test database and must not be deleted or cleaned
without exact-target authorization.

The approved run verified six-migration application, real PostgreSQL UNIQUE(email),
23505 with constraint `UQ_users_email`, concurrent registration HTTP 201/409 with
one winner, no losing-registration side effects through mock mail/JWT services,
and down/up of the sixth migration. A final negative test with synthetic duplicate
emails verified failure and transactional rollback. External mail delivery and
real JWT signing were not tested by this runner.

After the negative test, the retained database may contain synthetic duplicates,
five migration records and no `UQ_users_email`. It is not automatically cleaned
and is not eligible for the runner's fresh-empty-database gate. Consult
[the integration README](../test/email-unique/README.md) for the historical result
and safeguards; do not rerun against this retained database.

## Future work requiring a new plan and approval

- Recheck current container/volume and database identity read-only before operations.
- Review production data, canonicalization and duplicates before any production DDL.
  PostgreSQL lower(btrim(email)) is not identical to JavaScript toLowerCase().trim().
- Approve any new disposable database and runner separately; do not reuse existing
  synthetic-data databases or treat migration:show as inherently read-only on an
  empty database (TypeORM initialization can create history structures).
- Design and verify a logical backup/restore procedure. The verified VHDX copy is
  a preserved physical Docker backup, not evidence of a tested logical restore.

Do not create/drop databases, run/revert migrations, reset sequences, delete
volumes or restore data using this document. Preserve the existing VHDX backups
and all PostgreSQL volumes. No production migration or logical restore validation
is claimed by the historical test results.
