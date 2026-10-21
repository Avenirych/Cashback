# Canonical baseline and safe cleanup — 21 October 2026

The current application and isolated finance source are the authoritative development
baseline. Historical ancestry is preserved. Finance remains absent from the live AppModule;
this task does not authorize activation, financial migrations or database access.

## Recovery point

Verified external package:
`C:\Users\serge\AppData\Local\CashbackRecovery\canonical-baseline-20261021-103933-e64f0f2eb0714720a6b38ed959d1591a`.

74,207 regular files / 2,085,204,753 bytes were copied, with source/copy SHA-256
comparison for every file. `manifest.json` records paths, timestamps, sizes and hashes;
19 junction/symlink destinations are recorded rather than followed. Git history and refs
are preserved both in the copied `.git` and verified `all-refs.bundle`. Five representative
files, including local environment configuration and both lockfiles, passed reverse-copy
checks. Access to this new backup directory is restricted to the owner and SYSTEM.
No existing project/security ACL was changed. The first inventory attempt exceeded a Git
output buffer before copying; it was retained, and a fresh uniquely named package succeeded.

The linked frontend dependency directory outside the repository is not duplicated by the
package: its destination and dependency lockfile are preserved. Dependencies remain in place.
No unrelated personal directory was scanned. Known historical worktree/recovery paths and
Docker bind mounts are retained. Full machine-local file classification and junction inventory:
`work/canonical-file-classification.json`; deletion review: `work/canonical-cleanup-approval.json`.

**This is a source recovery package, not a PostgreSQL backup.** No active database connection,
dump or restore test was performed. The historical database and persistent volume remain
separately protected; complete database disaster recovery is not established.

## Git and publication

Original HEAD: `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`, branch
`cutover/historical-03573b7-20261020`. The new local commit/tag are recorded below after creation.
Reviewed candidate paths/hashes: `CANONICAL-BASELINE-SOURCE-MANIFEST.json`.
Local secrets, configuration archives, generated binaries, dependency trees and execution
archives are excluded; 24 financial specification/design/owner-policy documents under `work/`
are deliberately included. `.gitignore` preserves these explicit document exceptions.

Remote: `https://github.com/Avenirych/Cashback.git`; fetched default branch: `main`,
`d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f`. This remote contains 25 commits after the
shared historical ancestor. A new commit on the working branch cannot fast-forward main.
The owner authorized preparing a normal merge for review, not replacing remote history.
No force push, reset, rebase, branch deletion or remote main change is permitted/performed.
Hosted Actions and published candidate SHA remain UNVERIFIED until an approved merge is
published. No GitHub publication success is claimed.

Repository hygiene: `docker/compose.test.env` contains local non-placeholder secrets and is
excluded. Previously tracked `backend-logs.txt` contains contact data; remove it from the new
Git tree while retaining its local file and verified backup. No references to that filename
were found in application/tests/scripts/deployment definitions. Historical Git objects remain
unchanged; this task does not claim a complete historical-secret audit or erase old objects.
High-confidence private-key/access-token/JWT pattern scan of the proposed files found none;
password/token string matches in tests, translations and parameterized SQL were reviewed as
synthetic fixtures, labels or variable references. Pattern scanning is not proof of absence
of every possible secret. No sensitive values were printed or published.

## Complete local validation

- Backend: 519/519 tests, 61 suites, no reported open handles, natural exit 0.
- Frontend: 233/233 tests, 17 suites, no reported open handles, natural exit 0.
- Backend and frontend TypeScript: PASS.
- Backend production build: exit 0; a clean `npx tsc -p tsconfig.build.json --incremental false`
  emit was also required and passed. Existing incremental Nest cache can return success after
  deleting dist without recreating it; no unrelated build configuration change was made.
- Strict frontend `CI=true` production build: PASS. Tooling emits the existing Node fs.F_OK
  deprecation warning; no compilation/ESLint failure.
- Finance disposable PostgreSQL: 97/97 groups PASS; all 16 migrations and 11 readiness
  checks PASS. Original ordered group identity checks remain intact.
- Node syntax: 26 reviewed `.cjs`/`.mjs` files PASS. `git diff --check`: PASS.

Logs/results are local `work/canonical-*`; finance result is
`FINANCE-SERVICE-TEST-RESULT.json`, disposable archive
`work/finance-completion-290ff400-9955-4219-b9a7-8584921015b2`.
The first finance invocation stopped before resource creation because dist/finance was absent;
it ran successfully after the clean emit. Only exact newly owned test containers/network were
removed. No persistent test volume was created. The test image is retained.

## Protected runtime

Read-only inventory established all 18 existing containers, including stopped rollback
containers, persistent volumes, networks and required images. Local evidence:
`work/canonical-protected-before.json`. Existing identities/running states/start times and
volume inventory were independently checked by the finance runner.

- Backend: `ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`,
  `http://127.0.0.1:3006`.
- Frontend: `3d98e1595ae6cb6600a2460313cf020f154b2ec4c4595fe24b4ff37d66e675da`,
  `http://localhost:3004/`.
- PostgreSQL: `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`;
  protected recorded cluster `7698666936429441062`, DB `cashback_historical_03573b7`,
  volume `cashback-historical-03573b7-local-pgdata`. Cluster/database values were not
  re-queried because active database access is forbidden for this task.
- Mailpit: `4f60adf3ecbb3bd57c731e8d4bc25422c08c7843187ab8fad4a08d141fa0d636`.

No existing container was stopped, restarted, rebuilt or removed. No existing image, network,
volume, account, balance, PostgreSQL directory or schema was modified.

## Cleanup boundary

All historical backups, provenance, policy records, current dependencies, build directories,
avatars, secrets, external directories and Docker resources are retained. The approval inventory
lists 288 local evidence/archive paths with exact absolute path, size, backup location, risk and
retention decision. Their reported recoverable space is zero until item-specific use is reviewed.
Many are referenced by reports, junctions or even stopped Docker bind mounts: names alone do
not establish disposability. No blanket deletion request is made and no such deletion performed.

New baseline and cleanup outcome details follow after final Git/resource verification.
