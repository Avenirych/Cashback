# Pre-deployment gates (files preparation only)

**NOT READY FOR DEPLOYMENT; synthetic prototype, never production-ready.**
No command below that starts Docker/SQL is authorized by file-preparation work.

## Dependencies

requirements.txt is the human input specification. Dockerfile now installs
requirements.lock with --require-hashes --only-binary=:all:. Lock target is
CPython3.13/linux/amd64 only, enforced before pip. Both wheel byte SHA-256 values
were computed on public downloads and compared with PyPI JSON. Provenance records
filenames, URLs, actual hashes and wheel METADATA Requires-Dist. No packages installed.

The only selected extra is binary: psycopg3.2.10 -> psycopg-binary3.2.10.
Binary wheel has no Requires-Dist. Base conditional typing-extensions applies to
Python<3.13, tzdata to Windows, backports.zoneinfo to Python<3.9; none apply here.
Other extras c/pool/test/dev/docs are not selected. Native libraries embedded in
binary wheel are covered by its byte hash, not separate Python package pins.
A network index can still be unavailable; hashes enforce integrity, not availability.
Wheel platform installation and build remain unexecuted. The pinned base supplies
pip; image index/platform selection remains part of deployment evidence.

## External secrets: metadata only, then future mount probe

Run Check-ExternalSecrets.ps1 on Windows as serge before any deployment. It reads
only paths, attributes, sizes and ACL; never file values/hashes. Requires five
64-byte files, protected directory ACL, current-user owner and no other Allow
principal. Unexpected SYSTEM/Administrators grant also requests manual review,
not automatic ACL changes. Reparse points at directory/files are refused; operator
must also review ancestor path redirections/host policy. Deny ACE/effective access
is not conclusively proved by an Allow inspection.

```powershell
# Read-only, no Docker/SQL/secret contents:
& 'C:\Users\serge\cashback+\infra\finance-security-test\Check-ExternalSecrets.ps1'
```

64 bytes is compatible with the recommended fresh-generation format: 64 ASCII
hex characters, no BOM/newline. Size alone does not prove format, entropy or five
values being distinct. Use independently attested new generation; installer verifies
length/distinctness in memory only during separately authorized SQL provisioning.
Do not read/print values to satisfy preflight. common.py .strip() differs from
Postgres entrypoint handling: avoid whitespace/BOM in generation.

Current local env paths may still be EXTERNAL_SECRET_DIRECTORY examples: point
all five FS_*_FILE at reviewed external paths via separately reviewed nonsecret
config update. Do not change password bytes or repo ignore policy implicitly.
Compose file secrets are bind-backed, not encrypted vault; Windows ACL does not
prove Linux UID65534 access. A future separately authorized tools container may
open each /run/secrets path O_RDONLY then close WITHOUT reading bytes, checking
size64 and permissions. It must not import common/provision or call SQL. No mount
probe is executed now. If access fails, STOP; never automatically broaden ACL or
change Dockerfile to root. Docker Desktop share permissions/backend must be reviewed.

Do not log full Compose config, container environment, DSNs, SQL ALTER ROLE payloads,
password values or byte hashes. Provision uses ALTER ROLE PASSWORD: query tracing
and PostgreSQL statement/error logging must not record password-containing SQL.
Review logging policy before provisioning; no logging changes are made here.

## Independent cluster identity (future separate authorization)

1. BEFORE creation, read-only inventory confirms project/network/volume names absent.
Never adopt same-name objects. Archive nonsecret Docker context/engine platform and
expected image digest plus approved config/hash. No current cluster is reused.
2. AFTER separately permitted `up ... pg` only, record exact container ID, image,
creation timestamp, mount volume ID/name/labels and PGDATA, network membership.
There must be no old mounts/networks. Healthcheck is readiness only.
3. Independently read pg_controldata from the exact new PGDATA/container (no SQL),
then run inventory.py (read-only SQL). These need explicit exec/run/SQL permission.
Compare system identifiers; both must differ from7695793866029359141. They are
independent file/SQL observations, not two administratively independent witnesses.
4. Validate DB finance_security_test, PostgreSQL17.11 and observed DB OID; persist
nonsecret reviewed resource manifest and only then set FS_EXPECTED_CLUSTER.
5. Before provision, compare manifest IDs/mounts again. common.identity checks
name/major/version/expected ID but not manifest/mount/OID. inventory.py only prints
version and excludes one old cluster; it does not enforce17.11 or positive expected
ID. Those are mandatory operator checks until a separately approved stricter tool.
6. Run installer only after these gates; bootstrap role is privileged, even though
restricted fs_installer is created. This is initial bootstrap, not tested installer
separation. Post-install independently inspect CLOSED/auth-disabled and ACL. Tests
are not permission to activate production or alter existing finance DB.

FS_EXPECTED_CLUSTER placeholder is expected until NEW cluster is observed, but
forbids provisioning. Never choose an arbitrary different ID. Matching expected ID
from a caller env does not establish provenance without resource manifest.

## Remaining gates

Owner reports Docker29.8.2/Compose5.6.0/linux-amd64, config quiet PASS and collision
inventory PASS. These were not rerun during current restricted file work. Python
base and PostgreSQL OCI refs recorded in VALIDATION are owner-confirmed, not freshly
registry-resolved here. No build/pull/up/run/exec/SQL/package install occurred.

Still required: external files exist/current-user ACL/mount readability/newness;
actual local env paths; scoped manifest/cluster/OID corroboration; target-platform
build and dependency installation; SQL/permissions/concurrency acceptance; safe
logging; retention and separate deployment authorization. Synthetic open-admission
and fixed identity are not production issuer/reopen policy.

Next safe operation is metadata-only Check-ExternalSecrets.ps1 as serge. It creates
nothing, reads no password content and invokes no Docker or SQL. Any failure STOP.
Do not proceed from its PASS to infrastructure without explicit owner permission.
