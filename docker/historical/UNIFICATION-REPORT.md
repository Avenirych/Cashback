# Cashback unification — approval required

Manifest SHA-256: 7a2acb850731aeb57ea6f1ce7d60fa93a40998b122b5c3238d048e48f758ac1e
Machine-readable exact identities and rollback paths: UNIFICATION-MANIFEST.json.

## Current state
Canonical requested path: C:/Users/serge/cashback+; actual HEAD remains d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f on main, not the historical source.
Historical source: C:/Users/serge/AppData/Local/Temp/cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/historical-03573b7f47ba; target commit 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7 plus previously reviewed configuration only. Backend tree: src; React tree: cashback-frontend/src. Historical stack has never been activated; no historical .historical.env exists.
The only active application backend observed is cashback-docker-test-backend-1 (full ID in manifest), loopback port 3001. Its frontend is cashback-docker-test-frontend-1 on 3000; Mailpit UI is on 8025. No listener was observed on 3003/3004/3005/3006/8035/8036/15435/11025. Native PostgreSQL 16 service remains running (service PID 4908, PostgreSQL main process 6628); it was not connected to or changed. Observed Node processes belong to Codex tooling, not a historical application server; missing process metadata is not assumed verified ownership.
Docker remains desktop-linux / ec3d6303-4d66-4410-8317-b739cebc046c, 12 containers / 10 networks / 4 volumes. Financial-security and registration PostgreSQL projects are protected separate infrastructure and not disposable application duplicates.

## Backup and recovery evidence
Original full backup: C:/Users/serge/AppData/Local/Temp/cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/project; earlier 156758-file SHA-256 proof remains readable. Rehashed 415 preserved source files successfully in this task.
Prepared historical source/config: C:/Users/serge/AppData/Local/Temp/cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/unification-prepared-20261020-5f628ca58e3d4c829f8f6e8bbdd764c9; 311 copied files individually SHA-256 verified.
C:/Users/serge/AppData/Local/Temp/cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/unification-prepared-20261020-5f628ca58e3d4c829f8f6e8bbdd764c9/repository.bundle contains complete Git history/refs and passed git bundle verify. Uncommitted prepared source is preserved in the 311-file backup, not represented by the bundle alone.
No existing database dump/backup is certified. Therefore all existing PostgreSQL containers/volumes are KEEP, and no data reuse/removal is approved. READ ONLY schema observations are not backups.

## Database findings
Existing application test database: cashback_docker_test, OID 16384, PostgreSQL 17.11, cluster 7695793866029359141. Verified container: 02cabe6180fc651b16c87afc8dbd29b7209157d71d89545e51f6005c1f01aed4; exact database network/volume labels were checked before connecting. Metadata shows users/forum_users/forum_topics/forum_posts/topic/post/analytics_events, plus newer marketing_preferences/bonus tables and migration history. Existing users contain the historical name/email/password/email verification columns. No user records or secret values were selected.
Core tables exist, but full constraints/defaults/runtime-role/data compatibility is not certified. Do not infer that all newer schema must be downgraded, and do not attach this volume to an unreviewed restored application. The prepared isolated configuration still targets a NEW database, not this existing database. Selecting a reuse strategy requires review and explicit approval; it is not silently switched here.

## Cleanup classifications
KEEP: both source backups, Git bundle, all existing networks and data volumes, protected finance/registration databases, Windows PostgreSQL 16, existing application database, active nginx bind configuration.
CONSOLIDATE (approval required): canonical src, test and React trees plus root build/config files; historical worktree as promotion source; existing application frontend/backend after rollback-preserving replacement approval.
UNKNOWN: old E2E PostgreSQL/Mailpit/failed worker, stopped migration/integration containers, old Mailpit data persistence, native/financial harnesses and old launch scripts. No removal authorized by this classification.
REMOVE completed under generated-artifact permission only: historical cashback-frontend/.historical-build-cache (1 file), cashback-frontend/build (21 files). Both were known outputs of our offline build, unused by running Docker mounts/processes, and copied/verified into C:/Users/serge/AppData/Local/Temp/cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/unification-prepared-20261020-5f628ca58e3d4c829f8f6e8bbdd764c9/recreatable-artifacts before removal. They can also be regenerated with build-frontend-offline.cjs.
No source/configuration/worktree/container/network/volume/database was removed.

## Required approvals — no commands executed
1. Approve canonical source promotion in place with verified archives of every replaced tracked/untracked file, basing a distinct canonical branch on 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7 and applying only the reviewed technical adaptations. Do not rename/wipe the whole original directory: running nginx bind-mounts C:/Users/serge/cashback+/docker/mailpit-ui.nginx.conf. Preserve .git/worktree linkage, owner policy, unrelated financial materials and that mounted file. Any financial/source dependency uncertainty must be resolved before its archival, not ignored.
2. Approve stopping ONLY the existing application backend c9b40faedba2ea07a1a523cdb32f785d49b5be612a427d7c5f55d50beab5ef22 and frontend 3eb73efb43dc91eefeaba4ca7930631b7d0bcd94da2e9c7e11fce19df5fea146 before starting replacement services. Retain unchanged containers/images/volumes for rollback; do not stop PostgreSQL or use compose down. Mailpit/nginx consolidation additionally needs mail persistence/backup review and separate exact approval.
3. Approve a specific database choice. Option already prepared is a NEW isolated database cashback_historical_03573b7 with new volume cashback-historical-03573b7-local-pgdata; its schema.sql is explicit initialization and requires separate authorization. Existing data remains preserved and is not migrated. Reuse instead requires verified dump and full read-only compatibility/privilege review before configuration changes or writes.
4. Only after these barriers: approve builds/npm downloads, creation/start of the reviewed four-service canonical stack and read-only runtime verification. Preserve the condition of one active backend. The current baseline/read-only preflight must be refreshed after owner-approved consolidation; never overwrite the baseline merely to accept an unexplained change.
5. Separately approve any later deletion of source/worktrees/containers/networks/volumes/databases from an updated exact manifest. No blanket cleanup.

## Tests and browser URL
Previous preparation results still apply (no application code changed here): full backend/frontend TypeScript, both builds, Node syntax, Compose validation and 76 offline tests PASS; frontend build had existing warnings. Clean Docker image builds/dependency installation and runtime tests are not verified. Removed build output can be regenerated from verified source.
No canonical startup or authentication/registration request was performed. Proposed restored URL after approved activation: http://localhost:3004/ (NOT currently running). Current legacy frontend is published on http://localhost:3000/ and is not claimed to be the restored snapshot.

STOP: canonical replacement and stopping existing services require explicit approval. No duplicate backend was started, no schema/data was changed, and no existing Docker resource was mutated.
