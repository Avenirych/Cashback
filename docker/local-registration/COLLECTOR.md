# Read-only registration resource collector

## Existing PostgreSQL baseline CLI (Docker-only)

Three distinct checks now exist:

| Entry point | Scope | Result does not authorize |
| --- | --- | --- |
| `collector.ts` / `collectRegistrationAdmission` | Before creating an empty project; existing resources are collisions | Reuse of an existing cluster |
| `existing-postgres-baseline.ts` / `collectExistingRegistrationPostgresBaseline` | Existing exact PostgreSQL, no helpers; full fresh Docker inspection | Helper creation, service admission, SQL or migrations |
| `collectRegistrationServicePhase` | Already-created and independently attested helpers plus PostgreSQL | Creation or automatic policy approval |

Copy into ordinary local PowerShell; this command was NOT executed during source
implementation. Enter the path to the actual independently approved owner policy,
not a draft. No env file or password is loaded, and PATH/context are not changed:

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
$dockerCli = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$approvedPolicyPath = Read-Host 'Full path to existing approved owner policy'
if (-not (Test-Path -LiteralPath $dockerCli -PathType Leaf)) { throw 'STOP: Docker CLI unavailable' }
if (-not (Test-Path -LiteralPath $approvedPolicyPath -PathType Leaf)) { throw 'STOP: approved policy missing' }
node --use-system-ca -r ts-node/register docker/local-registration/existing-postgres-baseline.ts "$approvedPolicyPath" --docker-cli "$dockerCli"
if ($LASTEXITCODE -ne 0) { throw 'STOP: PostgreSQL baseline BLOCKED; do not provision' }
```

The policy retains its existing `daemonId`, `context`, `postgresImage`, `platform`
fields. An independently reviewed `existingPostgresBaseline` object is required:

- `containerId`: full expected PostgreSQL container ID.
- `networkId`: full independently approved database network ID.
- `templateSha256`: existing reviewed `TEMPLATE_SHA256` from admission.ts.
- `effectiveComposeSha256`: canonical normalized full Compose render hash with
  `--no-interpolate --no-normalize --no-path-resolution`, all profiles exposed for
  **config rendering only**, explicit empty env-file and exact project/file.
- `postgresSha256`: existing `registrationPeerFingerprint(containerInspect)`.
- `networkSha256`: existing `registrationNetworkFingerprint(networkInspect)`.
- `volumeSha256`: existing `configDigest(volumeInspect)`.

All hashes are 64 lowercase hex characters, with no `sha256:` prefix. These are
approval inputs, never automatically filled or approved from current observations.
This task does not modify the approved policy. An existing four-field policy
therefore returns `BLOCKED / POLICY_INCOMPLETE` until an independent owner review
supplies the required assertions. Draft envelopes are rejected. Policy provenance
remains the existing owner-reviewed protected-file trust boundary; a CLI path is
not an independent approval action.

Only context show, info, complete container/network/volume lists, exact resource
and local pinned-image inspect, and Compose config are invoked. Inspection of
protected projects is read-only and used solely for before/after fingerprints.
No registry access, pull, Docker creation, exec, SQL or provisioning is performed.
Raw inspect/config output, policy contents and credentials are never printed.
Errors are sanitized; BLOCKED exits nonzero. The module can be imported without IO.

STOP conditions: missing policy assertions → `POLICY_INCOMPLETE`; daemon/context,
container/image/platform/config mismatch or stale evidence → `IDENTITY_MISMATCH`;
unexpected project resources, peer, mount/volume/port or protected-resource drift
→ `UNEXPECTED_RESOURCE`; failed CLI/inspection/parse → `DOCKER_UNAVAILABLE`.
Each refusal is machine-readable JSON with `status: BLOCKED` and `reason`.
Container security-fingerprint drift may refuse as IDENTITY_MISMATCH before the
more specific mount/port checks. No refusal is automatically repaired.

Success is `POSTGRES_BASELINE_VERIFIED`, not service admission. Collection must
complete within 30 seconds; inventory, configuration and protected-project
fingerprints are rechecked. It proves observed stability during collection only,
not historical immutability or fencing. Cluster identifier is explicitly
`NOT_CHECKED_NO_SQL`: existing SQL target collectors require additional role/peer
contracts and are intentionally not invoked by this Docker-only mode.
`SERVICE_ADMITTED=false`, `APPLY_ELIGIBLE=false` and
`PHONE_APPLY_CONCURRENCY_VERIFIED=false` remain closed; helper creation remains
`CREATION_AUTHORITY_NOT_PROVISIONED`.

This collector invokes the existing admitRegistrationResources in admission.ts.
It does not replace that gate and cannot create, pull, build, start, stop, connect
to a database, or delete anything. Importing it has no side effects.

## Trusted boundary and usage

The production CLI accepts ONLY the path to an independently owner-reviewed
AdmissionPolicy (daemonId/context/postgresImage/platform). It does not accept JSON
observations, fixture receipts, inventory files or verified=true switches. No policy
has been created or approved by this task. Never derive approved daemon identity
from an observation merely because it matches itself. CollectorIO injection is for
trusted source/unit-test composition only; it is not available through the CLI.

From repository root, after Docker read-only access and policy are approved:

```powershell
node --use-system-ca -r ts-node/register docker/local-registration/collector.ts C:\approved-registration\admission-policy.json
```

The path above is a proposed future location, NOT an existing or generated file.
The four REGISTRATION_* variables must be supplied separately in the process
from a dedicated approved source; the collector neither generates nor stores them.
Do not print rendered Compose or use config --environment in diagnostics.

The CLI child environment has an OS-path allowlist; inherited DOCKER_HOST,
DOCKER_CONTEXT, COMPOSE_FILE, COMPOSE_PROFILES, COMPOSE_PROJECT_NAME,
DOCKER_DEFAULT_PLATFORM and Docker TLS overrides are not forwarded. Every daemon
command uses the explicitly reviewed context. Compose uses one explicit file/project,
COMPOSE_DISABLE_ENV_FILE=1 and an empty env-file device, so existing .env is not read.
All profiles are enabled for read-only CONFIG RENDERING only, to inspect hidden
services. The future creation invocation has no profiles and only postgres-test.
Normalization reverses only reviewed equivalent port/network/dependency forms;
unknown fields survive to fail the exact existing admission comparison. Unexpected
Compose serialization may cause refusal: do not fix refusal by copying the template
over observations or by accepting arbitrary defaults. Effective-config compatibility
has not been validated against the unavailable engine/Compose runtime.

Docker calls use execFile(shell=false), 10-second timeout, bounded stdout and no
stderr/raw-error forwarding. They are only context show, info, ps --all, network ls,
volume ls and compose config. No existing component is individually inspected.
Inventory is collected twice, includes full IDs and project labels, and refuses
changes/context/daemon drift. Started-at timestamps preserve the existing 30-second
admission freshness checks. Two lists are not an atomic reservation: a future launch
must re-collect immediately and retain exclusive operational control. A PASS is not
persistent authorization or permission to start applications/schema migrations.

Registry checks use fixed official auth.docker.io and registry-1.docker.io endpoints
for library/postgres:17-bookworm. Only bounded index, platform-manifest and config
metadata are read; no layer is requested. The index Docker-Content-Digest and all
child/config byte SHA-256 values are verified; the config must confirm the platform
and PG_MAJOR=17/PG_VERSION=17.x. Only linux/amd64 and linux/arm64 are supported by
this collector. The pinned reference must use the matching PLATFORM MANIFEST digest,
not the multi-platform index digest. Registry tokens remain in memory; redirects
never receive Authorization; only config-blob redirects to HTTPS
production.cloudfront.docker.com:443 are accepted. Auth/index/manifest redirects refuse.
On this Windows host Node requires --use-system-ca; certificate verification remains
enabled. Do not disable TLS validation to bypass trust errors.
Failure, drift, unsupported redirect/platform or missing metadata blocks admission.

## Observed preparation state — 2026-10-17

- Current context: desktop-linux.
- Endpoint: npipe:////./pipe/dockerDesktopLinuxEngine.
- Engine unreachable: the named pipe does not exist. No daemon ID/platform or complete
  container/network/volume/local-image inventory could be obtained. Existing resources
  and reserved-name collisions remain UNKNOWN, not absent. Docker Desktop was not started.
- TCP listeners observed: 5432 on IPv4/IPv6, 6432 on loopback IPv4/IPv6,
  3000 and 3003 on IPv6 loopback. No listener was observed for 3001 or 8025.
  PostgreSQL in the reviewed template publishes NO host port, so occupied host 5432
  is not permission to stop it and is not a bind conflict for the first PG-only step.
  Port 3003 must be rechecked before any later frontend launch; no process was stopped.
- Official registry metadata verified without downloading layers:
  index sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826
  linux/amd64 manifest sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df
  config sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f
  PG_VERSION=17.11-1.pgdg12+2.
  This is an image candidate, NOT approved daemon/platform matching or resource admission.
  Tag contents and freshness must be reverified for a future launch.

Admission is BLOCKED: no live engine/complete inventory, no owner-reviewed daemon
policy and no approved secret supply. No PASS receipt was manufactured.

## Exact future PostgreSQL-only command — NOT executed

After separate creation/start authorization, fresh admission PASS, available reviewed
image and distinct approved secrets in the proposed dedicated external env file:

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
docker --context desktop-linux compose --env-file 'C:\approved-registration\registration.env' --project-name cashback-registration-20261016-4f8c2a96b17d --file docker/local-registration/compose.registration.json up --detach --no-deps --no-build --pull never postgres-test
```

No env file was created by this task; use the actually approved path consistently.
Only postgres-test is selected, no profile/override is allowed. --pull never refuses
if the exact pinned image is not already local; acquiring that image would require
SEPARATE permission because docker pull is currently prohibited. Do not omit this
flag to trigger an implicit pull. Clear conflicting inherited Compose/Docker overrides
in the dedicated future launch process; do not change existing .env or user secrets.
The command must not follow an old PASS: re-collect against the same approved env
values immediately, stop on any mismatch, collision, stale or incomplete evidence.

This creates/starts only the selected new PostgreSQL service and its required new
Compose resources. It authorizes neither bootstrap/phone migrations, SQL connections,
backend, frontend, Mailpit nor synthetic registration. Phone Harness, concurrency
gate, readiness policy and Mailpit guard were not changed by this collector task.

## Effective Compose representation normalization (Compose 5.6.0)

Only collector normalization changed; admission.ts, its template hash, the Compose
source, approved policy, secrets and Mailpit guard remain unchanged.

The four observed differences originate in the typed model and config serialization:

- Omitted command/entrypoint become JSON null. Both null and omission use image
  defaults. Normalize only null; empty strings/lists and non-null overrides remain
  subject to the exact admission comparison. Removing a required mailpit-ui command
  or entrypoint still fails the comparison.
- Network IPAM is a value struct in compose-go, serialized as an empty object when
  no settings are specified. Remove only a non-array empty object. Any driver,
  subnet, options, null/array value or unknown field remains and is rejected.
- Compose 5.6.0 runConfig replaces each output dollar with two dollars AFTER model
  serialization, for both JSON and YAML when interpolation is enabled. Thus the
  source Mailpit regex @example\.test$ is rendered as @example\.test$$. The model
  used by container creation retains the single end anchor. This is output escaping,
  not a change to Mailpit matching semantics. Reverse ONLY that exact reviewed
  escaped regex at services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS; do not
  unescape arbitrary strings or remove anchors. Changed domains/dots/anchors,
  additional dollars and broader patterns still fail admission.

Evidence (reviewed official sources):
- https://docs.docker.com/reference/compose-file/services/#command
- https://docs.docker.com/reference/compose-file/services/#entrypoint
- https://docs.docker.com/reference/compose-file/interpolation/
- https://github.com/docker/compose/blob/v5.6.0/cmd/compose/config.go#L182-L184
- https://github.com/docker/compose/blob/v5.6.0/go.mod (compose-go v2.16.1)
- https://github.com/compose-spec/compose-go/blob/v2.16.1/types/types.go (NetworkConfig/IPAMConfig)

Regression tests exercise the existing collector and admission together, accepting
only these representations and rejecting altered commands, entrypoints, IPAM,
allowlist, unknown fields, images, volumes, networks and ports. No runtime resource
operation is part of the tests. A live collector PASS is only a fresh read-only
observation; PostgreSQL creation/start always requires separate authorization.
