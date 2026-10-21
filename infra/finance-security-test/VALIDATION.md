# Security harness preparation validation — 2026-10-14

**NOT READY FOR DEPLOYMENT. Synthetic harness is not production-ready.**

## Changed files

Modified Dockerfile, README.md, VALIDATION.md.
Added requirements.lock, dependency-provenance.json, Check-ExternalSecrets.ps1,
PREDEPLOYMENT.md and test_dependency_lock.py. requirements.txt remains the human
input specification. Nothing outside infra/finance-security-test changed in this task.
No credentials, actual secret bytes, Docker, SQL or package installation used.

## Image / host evidence

Owner confirmed Docker Engine29.8.2, Compose5.6.0, linux/amd64, Compose config --quiet
PASS and no harness resource-name collisions. These external checks were not rerun.

Owner-confirmed PostgreSQL17.11 reference in dedicated local env:
postgres:17-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826

Python3.13.16 reference preserved byte-for-byte as Dockerfile FROM:
python:3.13-slim-bookworm@sha256:a1165e272e578941b84abc79e4ab38a0305cd12803a5c4247979ac7655f4d641

These are OCI references confirmed by owner, not freshly registry-resolved in
this task. No invented hashes/digests. No build/pull/up/run/exec occurred.

## Dependency verification actually performed

Read public PyPI release JSON and downloaded two public wheel artifacts into
memory only, without executing/installing them. SHA256 computed from actual bytes
matched PyPI metadata. Wheel METADATA extracted in memory; provenance records
URL/filename/version/hash/Requires-Dist. No wheel files stored in repository.

psycopg3.2.10 py3-none-any SHA256:
ab5caf09a9ec42e314a21f5216dbcceac528e0e05142e42eea83a3b28b320ac3

psycopg-binary3.2.10 CPython313 manylinux x86_64 SHA256:
a92ff1c2cd79b3966d6a87e26ceb222ecd5581b5ae4b58961f126af806a861ed

For CPython3.13/Linux/binary extra only, dependency closure is these two packages.
Conditional backports.zoneinfo/typing-extensions/tzdata do not apply to this target;
other extras not selected. Binary wheel declares no further Python requirements.
Native bundled dependencies are pinned through the binary artifact hash.
Dockerfile now uses --require-hashes --only-binary=:all: and checks target before
pip. Wheel installation/platform compatibility and build still unexecuted.

Sources: https://pypi.org/pypi/psycopg/3.2.10/json and
https://pypi.org/pypi/psycopg-binary/3.2.10/json (primary release metadata).

## Offline results

static_check.py PASS: Python AST, denylist, SQL contracts, UTF8/whitespace.
python -B test_runner_control.py: 5/5 PASS (no DB imports).
python -B test_dependency_lock.py: 2/2 PASS (provenance/lock/build flags).
PowerShell parser: Check-ExternalSecrets.ps1 PASS, script NOT executed.
No bytecode, packages, Docker or SQL generated/executed by these checks.

## Secrets / identity gates

Check-ExternalSecrets.ps1 is read-only presence/size/ACL inspection, never secret
content. Does not conclusively prove Linux effective readability or secret format/
entropy/newness/distinctness; PREDEPLOYMENT specifies trusted generation and a
future separately permitted open-without-read mount probe. Additional Allow SIDs
are fail-closed for manual review, not an automatic ACL change. Existing local
FS_*_FILE placeholder paths need explicit nonsecret config correction. No local
env or secret file was changed/read by this task.

FS_EXPECTED_CLUSTER must remain unknown until a newly permitted instance is
observed. Cross-check exact new Docker resources/PGDATA with pg_controldata and
read-only SQL inventory; persist manifest and DB OID. common.identity alone does
not validate manifest/mounts/OID; inventory.py prints version without enforcing
17.11. Independent file/SQL observations do not imply independent administrators.
No cluster ID can be obtained before creating an instance; placeholder forbids
provisioning, not the prior planning phase. No SQL operation performed.

Remaining: actual five files/ACL/paths, effective Docker Desktop mount access,
image/platform build, safe logging during ALTER ROLE PASSWORD, independent new
cluster manifest/OID, SQL/ACL/concurrency and bootstrap/installer separation.
Production authorization/reopen/full grant/mixed isolation remain beyond prototype.

Next safe operation: metadata-only Check-ExternalSecrets.ps1 on Windows as serge;
on any failure STOP. No deployment follows without separate explicit authorization.

## Offline wheelhouse update — 2026-10-14

Changed Dockerfile, .dockerignore, static_check.py, test_dependency_lock.py, README.md
and VALIDATION.md. Added wheelhouse/psycopg-3.2.10-py3-none-any.whl and
wheelhouse/psycopg_binary-3.2.10-cp313-cp313-manylinux2014_x86_64.manylinux_2_17_x86_64.whl.
Lock/provenance/base OCI digest unchanged; local env/secrets/SQL untouched.

Both HTTPS downloads succeeded with default TLS certificate validation. Artifacts
held in memory until both SHA256 checks passed, then written with exclusive create.
Hashes match both lock and provenance: PASS. No substitutions or source fallback.

Static text/AST/UTF8/whitespace checks PASS. Dependency/wheelhouse tests4/4 PASS:
exact wheel set, computed hashes, ZIP integrity, Docker offline flags and allowlist.
Runner exit policy5/5 PASS. No installation/build/container/SQL executed.

Dependency RUN has --network=none, --no-index, --find-links, --require-hashes,
--only-binary=:all: and disabled pip version check; no network dependency retrieval.
Base image/build machinery may still use network independently of this RUN.

READY FOR SEPARATELY AUTHORIZED DOCKER BUILD only. Actual Docker layer execution/
platform installation remains unverified. Deployment/SQL remains NOT READY until
secret mounts, new cluster identity/resources, permissions/concurrency and other
PREDEPLOYMENT gates are checked. Synthetic harness not production-ready.
