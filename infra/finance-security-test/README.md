# Isolated finance security harness â€” 6V.5.9-E (FILES ONLY)

**READY for a separately authorized offline dependency Docker build; NOT READY for deployment/SQL.**

Nothing has been deployed or SQL-tested. This is a synthetic security prototype,
NOT a migration or integration of src/finance. Existing writers are untouched.
Only the new files in this directory are authorized in this stage.

## Files and scope

compose.yaml creates a separate project `cashback-finance-security-9f`, private
internal network and new PGDATA volume. No published ports, application mounts,
shared volumes, Docker socket, privileged container or main DB config.
Dockerfile builds only this harness with a preserved owner-confirmed Python OCI digest.
requirements.lock pins the complete selected Python wheel closure for CPython3.13/linux-amd64
with verified byte hashes; pip requires hashes and binary wheels. See PREDEPLOYMENT.md.
PG digest is owner-confirmed in the dedicated local env; no secret values are included.
SQL files create a NOLOGIN protected owner, installer, separate runtime LOGIN,
authority LOGIN and operator LOGIN. Passwords are injected in memory from separate
new external secret files. No automatic SQL startup hook or application migrations.

The authority mapping is explicitly SYNTHETIC. A trusted offline fixture issuer
predefines LOGIN -> principal -> participant in the private registry. PostgreSQL
SCRAM authenticates session_user. Definer methods derive identity from that mapping,
create owner-private full xid/backend/login-bound contexts, and check current DB
authority under a shared transaction lock/fence. GUCs, payload roles and JWTs do not
authorize anything. Revoke COMMIT is the linearization point. Functions hold the
same gate to outer commit; SS stale snapshots conflict through fence UPDATEs.

The protected counter is a probe, not cash/coverage. Runtime cannot read or mutate
private tables, call internal helpers, become owner/installer, or open admission.
`open_synthetic_admission` is intentionally a TEST-ONLY operator entrypoint. It is
NOT the production reopen/independent acceptance protocol described in 9C/9D.
Production trust remains disabled; this harness must never be connected to AppModule.

## Secrets and ignore policy

Root .gitignore already ignores `.env` and work/. It does NOT generally ignore
arbitrary secret files beneath infra. It was not changed. Keep ALL real password
files outside the repository, with restricted host ACL. Do not place them beside
compose.yaml, in image build context, reports or env example. The installer checks
new secret length and distinctness; it cannot prove they were not used elsewhere.
The operator must attest fresh generation. Never use existing DB_PASSWORD or
DATABASE_URL. Compose file secrets are not an encrypted vault.
No real credentials are included. Test orchestration receives runtime/authority/
operator secrets but never bootstrap/installer credentials. Each negative test
uses a real runtime connection, not a SET ROLE owner connection.

## Future commands â€” require separate authorization

From project root, first perform read-only Docker inventory, exact name/volume/
network collision checks and verify a separate new cluster is permitted. If CLI
is unavailable, STOP; do not use alternate daemon/API/WSL. Never adopt existing
same-named resources. No deletion commands are supplied.

Create a nonsecret env file outside the repo based on compose.env.example; create
five distinct new password files outside the repo. Confirm resolved file paths
are outside checkout before deployment. The examples below use a placeholder;
replace it with the reviewed absolute nonsecret env path.

```powershell
# Offline only; this command is safe in FILES ONLY mode:
python infra/finance-security-test/static_check.py
python -B infra/finance-security-test/test_runner_control.py

# BELOW: future authorized deployment/testing only, not executed in this stage.
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml build inventory installer admission-faults tests
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml up -d pg
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml run --rm --no-deps inventory
```

Independently inspect exact Docker mounts/network/resource IDs and record new
system_identifier. It MUST differ from historical cluster 7695793866029359141.
Set FS_EXPECTED_CLUSTER in the external nonsecret env file to the approved new ID.
No password values in logs or resolved config output. `inventory` executes only
read-only SQL. Healthcheck does not prove schema, identity or permissions.

```powershell
# One explicit future install only, refuses an existing harness schema:
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml run --rm --no-deps installer
# Future transactional fault injection; bootstrap only, no committed faults:
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml run --rm --no-deps admission-faults
# Future security checks, real DB sessions; finishes with admission CLOSED:
docker compose --project-name cashback-finance-security-9f --profile tools --env-file <external-env-path> -f infra/finance-security-test/compose.yaml run --rm --no-deps tests
```

Tests: raw SQL and role escalation denied, missing/forged context denied,
valid context and transaction-crossing denial, guard rollback, concurrent revoke
with actual pg_blocking_pids barrier, CLOSED admission, failed-open transaction
rollback. Tests retain all fixtures/history and never reset a DB. They may be
repeated after the reviewed installed baseline. No automatic retry of provisioning.
Failures print classification only, avoiding credentials/raw SQL error dumps.
Final close plus SQL CLOSED verification precede aggregate PASS. Failure returns nonzero
and preserves both original and cleanup error classifications; operator must reconcile.

## Acceptance and limits

Offline checks prove only text/AST properties, not SQL validity or Compose engine
semantics. SQL, images, dependencies, healthcheck and concurrency are UNEXECUTED.
Future acceptance requires all tests passing, isolated mounts/network/cluster proof,
role/ACL/default-privilege catalog audit, and preserved CLOSED after suite.
No real ledger/outbox/receipt regression or multi-lot/apply/candidate integration
is claimed. Cross-account participant independence, mixed-isolation race matrix,
production issuer, acceptance-approval reopening, and bounded retry executor need
separate expanded tests/implementation. Functions are synthetic scaffolding only.
The package does not partially cut over existing finance writers.

Docker-admin/bootstrap/installer remain privileged trust boundaries. Same-engine
internal network is not a protection against host administration; a separate VM
may be necessary. Full SQL transaction rollback test is not crash recovery testing.

## Lifecycle

Never remove or reset existing volumes. Retain this new instance and reports until
separate deletion permission. Before any later removal: CLOSED, exact sessions
drained, manifests/labels/mount IDs verified, no old-container attachments and
no real data; archive approved artifacts. No cleanup script, wildcard deletion,
global cleanup or automatic data reset exists here.

## 6V.5.9-Z file fixes

Admission missing row and NULL fail closed through FOUND checks and IS NOT TRUE.
Runtime receives no admission recovery rights. Separate admission-faults bootstrap
service tests corrupt states with transactional DELETE/ALTER/NULL updates; it
switches session authorization to the real runtime identity only for refusal probes,
then rolls everything back. It is NOT a runtime service or production repair API.
Regular tests never receive bootstrap credentials. Synthetic guard tests SELECT
persisted/transaction-local state for positive deltas, denials, rollback and two
concurrent changes. The synthetic counter is not a funding lot.

Owner confirmed PostgreSQL17.11 and Python3.13.16 OCI digests and linux/amd64.
Exact refs and evidence limits are recorded in VALIDATION.md. Compose quiet PASS was
reported by owner; not rerun here. Current file work never invokes Docker or SQL.
See PREDEPLOYMENT.md and Check-ExternalSecrets.ps1 for remaining secret/identity gates.

## Offline dependency build — 6V.5.9

wheelhouse contains exactly the two wheels named in dependency-provenance.json.
Both were downloaded through verified HTTPS and their computed byte SHA256 values
matched requirements.lock/provenance. They are not packages installed on the host.
Dockerfile copies the two exact filenames and uses RUN --network=none plus pip
--no-index --find-links=/wheelhouse --require-hashes --only-binary=:all: with
--disable-pip-version-check. Python OCI digest is unchanged. Network package
downloads during this RUN are excluded; unavailable/mismatched wheels fail closed.
The .dockerignore admits only these two wheelhouse files, not arbitrary archives.
static_check skips binary wheels as text; test_dependency_lock separately validates
every wheel byte hash, exact directory contents and ZIP integrity.

Offline commands: python static_check.py; python -B test_dependency_lock.py
(4 tests); python -B test_runner_control.py (5 tests). Run from this directory.
No Docker build has been run after this change. Existing README build commands
remain future separately authorized operations. Base image/builder resolution may
still require Docker network access; this is not a fully air-gapped build.
PREDEPLOYMENT's earlier package-index availability warning is superseded for the
installation RUN by this wheelhouse; all secret/cluster/deployment gates remain.
Synthetic harness is never declared production-ready.
