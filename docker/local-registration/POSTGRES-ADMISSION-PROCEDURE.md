# Registration PostgreSQL preparation — DRAFT, NOT runtime permission

No approved policy, real secret, image reference or Docker resource was created by
this preparation. Commands below are future instructions, not an executable runbook
to paste wholesale. STOP at every missing permission. Do not run Docker pull/tag/
build/run/up or any secret-generation block under the present authorization.

## 1. Explicit owner review

Review the nested policy in owner-policy.draft.json:
- daemonId ec3d6303-4d66-4410-8317-b739cebc046c
- context desktop-linux; platform linux/amd64
- postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df
- fixed project cashback-registration-20261016-4f8c2a96b17d
- only docker/local-registration/compose.registration.json; no overrides/profiles
- only postgres-test; no host PostgreSQL port.

The DRAFT_NOT_APPROVED envelope has no top-level AdmissionPolicy fields and is
intentionally rejected by the collector. Never automatically strip this envelope
or treat observations/tests as approval. AFTER explicit owner approval of the exact
nested object, and permission to prepare private storage, the owner may store only
those four approved fields as owner-policy.approved.json in the private directory
below. No such approved file was created. No promotion command is provided here.

Separate approvals are needed for (a) the exact policy/private storage, (b) generation
of three synthetic secrets, (c) acquisition of the exact image reference, and
(d) creation/start of only the new PostgreSQL. None authorizes database connections,
migrations, backend/frontend/Mailpit, accounts, reuse, cleanup or destruction.

## 2. Index versus manifest: existing rules unchanged

Local multi-platform index:
sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826
Selected linux/amd64 manifest:
sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df

These digests identify different objects. admission.ts accepts the reference syntax
for either, but requires trusted digestVerified evidence. Existing collector compares
the supplied digest with the selected platform manifest: index verification returned
REGISTRATION_COLLECTOR_BLOCKED:IMAGE_NOT_OFFICIAL_TAG_PLATFORM. End-to-end admission
therefore does NOT currently permit the index reference. No rule was changed.
Do not supply verified=true, use fixtures, switch to a mutable tag/index, or edit
TEMPLATE_SHA256 to obtain PASS. The draft keeps the platform manifest pinned.

## 3. Private directory and cryptographic secret generation — future permission only

Use a fresh PowerShell 7.2+ process (-NoProfile), without transcripts/debug tracing.
Proposed private location, outside Git and Docker build context:
%LOCALAPPDATA%\CashbackRegistration\cashback-registration-20261016-4f8c2a96b17d

After separate private-storage permission, create a NEW directory and restrict its
ACL before writing policy or secrets. STOP if it exists; do not adopt/overwrite it.

```powershell
$ErrorActionPreference = 'Stop'
$privateDir = Join-Path $env:LOCALAPPDATA 'CashbackRegistration\cashback-registration-20261016-4f8c2a96b17d'
if (Test-Path -LiteralPath $privateDir) { throw 'STOP: private directory exists' }
New-Item -ItemType Directory -Path $privateDir -ErrorAction Stop | Out-Null
if ((Get-Item -LiteralPath $privateDir).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'STOP: reparse directory' }
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($ownerSid)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($ownerSid, $systemSid)) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $privateDir -AclObject $acl
(Get-Acl -LiteralPath $privateDir).Access | Format-Table IdentityReference,FileSystemRights,IsInherited
```

STOP until owner verifies only the intended user and SYSTEM have access. STOP if
ACL enforcement is unavailable. Then, ONLY after explicit secret-generation
permission, execute the next block once in that same private preparation session.
It draws 32 random bytes independently three times with the .NET cryptographic RNG,
stores 64-character hex strings, never prints them, and uses CreateNew (no overwrite).

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
$repoRoot = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$resolvedPrivate = (Resolve-Path -LiteralPath $privateDir).Path.TrimEnd('\')
if ($resolvedPrivate.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or $resolvedPrivate.StartsWith($repoRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'STOP: secret directory is inside repository' }
$envFile = Join-Path $resolvedPrivate 'registration.env'
$values = @(1..3 | ForEach-Object { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() })
if (@($values | Select-Object -Unique).Count -ne 3) { throw 'STOP: RNG equality; do not continue' }
$text = 'REGISTRATION_ADMIN_PASSWORD=' + $values[0] + "`n" + 'REGISTRATION_APP_PASSWORD=' + $values[1] + "`n" + 'REGISTRATION_JWT_SECRET=' + $values[2] + "`n" + 'REGISTRATION_POSTGRES17_IMAGE=postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df' + "`n"
$stream = $null; $writer = $null
try {
  $stream = [IO.File]::Open($envFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
  $writer.Write($text)
} catch { throw 'STOP: private secret-file write failed; do not overwrite or retry blindly' }
finally {
  if ($writer) { $writer.Dispose() } elseif ($stream) { $stream.Dispose() }
  $values = $null; $text = $null
}
(Get-Acl -LiteralPath $envFile).Access | Format-Table IdentityReference,FileSystemRights,IsInherited
```

Verify inherited ACL metadata, never contents. Strings may remain in process memory;
close the dedicated session after preparation. Do not echo, screenshot, log or put
these values in Git. This procedure never uses or changes existing credentials or
project .env files. On write/ACL uncertainty STOP; retain state for separately
approved investigation, with no automatic deletion/regeneration. The owner-approved
policy belongs in the same restricted directory only after step 1.

## 4. Exact pinned-reference acquisition — separate image-store permission

Read-only lookup first (failure is NOT permission to pull):

```powershell
$ref = 'postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df'
docker --context desktop-linux image inspect --platform linux/amd64 $ref --format '{{json .Descriptor}}'
```

If missing, STOP. After separate authorization for THIS exact image-store operation:

```powershell
# NOT AUTHORIZED BY THIS PREPARATION; execute only after explicit pull permission.
docker --context desktop-linux pull --platform linux/amd64 postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df
if ($LASTEXITCODE -ne 0) { throw 'STOP: approved image acquisition failed' }
```

A pull may reuse layers but is still a write and may download missing data. Repeat
the read-only lookup and require the exact digest/platform. A tag-only lookup or
index RepoDigest is insufficient. No tag/prune/remove/container-start workaround.

## 5. Repeat collector and PostgreSQL-only creation — separate runtime permission

Use a fresh PowerShell 7.2+ -NoProfile session with exclusive operational control.
All approved private files must already exist. The block below loads only their
four dedicated variables into this process and clears launch-process overrides;
it does not edit any existing file or machine/user-level environment.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
$privateDir = Join-Path $env:LOCALAPPDATA 'CashbackRegistration\cashback-registration-20261016-4f8c2a96b17d'
$envFile = Join-Path $privateDir 'registration.env'
$approvedPolicy = Join-Path $privateDir 'owner-policy.approved.json'
if (!(Test-Path -LiteralPath $envFile) -or !(Test-Path -LiteralPath $approvedPolicy)) { throw 'STOP: approved files missing' }
foreach ($name in @('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_CONFIG','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','DOCKER_DEFAULT_PLATFORM','COMPOSE_FILE','COMPOSE_PROFILES','COMPOSE_PROJECT_NAME','COMPOSE_PATH_SEPARATOR','COMPOSE_ENV_FILES','NODE_OPTIONS')) {
  [Environment]::SetEnvironmentVariable($name, $null, 'Process')
}
$env:COMPOSE_DISABLE_ENV_FILE = '1'
$required = @('REGISTRATION_ADMIN_PASSWORD','REGISTRATION_APP_PASSWORD','REGISTRATION_JWT_SECRET','REGISTRATION_POSTGRES17_IMAGE')
$loaded = @{}
foreach ($line in [IO.File]::ReadAllLines($envFile)) {
  $parts = $line.Split('=', 2)
  if ($parts.Count -ne 2 -or $parts[0] -notin $required -or $loaded.ContainsKey($parts[0]) -or !$parts[1]) { throw 'STOP: invalid dedicated env file' }
  $loaded[$parts[0]] = $parts[1]
}
if ($loaded.Count -ne 4) { throw 'STOP: incomplete env file' }
foreach ($key in $required) { [Environment]::SetEnvironmentVariable($key, $loaded[$key], 'Process') }
$loaded.Clear()
# Read-only service filtering WITH real values, never placeholder credentials.
$selected = @(docker --context desktop-linux compose --env-file $envFile --project-name cashback-registration-20261016-4f8c2a96b17d --file docker/local-registration/compose.registration.json config --services postgres-test)
if ($LASTEXITCODE -ne 0 -or $selected.Count -ne 1 -or $selected[0] -ne 'postgres-test') { throw 'STOP: unexpected services' }
$local = docker --context desktop-linux image inspect --platform linux/amd64 $env:REGISTRATION_POSTGRES17_IMAGE --format '{"Descriptor":{{json .Descriptor}},"Os":{{json .Os}},"Architecture":{{json .Architecture}}}'
if ($LASTEXITCODE -ne 0) { throw 'STOP: pinned reference missing' }
$image = $local | ConvertFrom-Json
if ($image.Descriptor.digest -ne 'sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df' -or $image.Os -ne 'linux' -or $image.Architecture -ne 'amd64') { throw 'STOP: image metadata mismatch' }
if ($image.Descriptor.PSObject.Properties.Name -contains 'platform') {
  if ($image.Descriptor.platform.os -ne 'linux' -or $image.Descriptor.platform.architecture -ne 'amd64') { throw 'STOP: descriptor platform mismatch' }
}
# Descriptor.platform is optional; top-level platform checks remain mandatory.
# Image ID is not universally a manifest digest and is not used for this comparison.
$started = [DateTimeOffset]::UtcNow
$reportRaw = node --use-system-ca -r ts-node/register docker/local-registration/collector.ts $approvedPolicy
if ($LASTEXITCODE -ne 0) { throw 'STOP: collector refused' }
$report = $reportRaw | ConvertFrom-Json
if ($report.status -ne 'PASS' -or ([DateTimeOffset]::UtcNow - $started).TotalSeconds -gt 30) { throw 'STOP: no fresh admission' }
```

STOP HERE unless explicit PostgreSQL CREATE/START permission has already been granted.
Under that permission only, immediately in the same exclusive session:

```powershell
if (([DateTimeOffset]::UtcNow - $started).TotalSeconds -gt 30) { throw 'STOP: recollect admission' }
docker --context desktop-linux compose --env-file $envFile --project-name cashback-registration-20261016-4f8c2a96b17d --file docker/local-registration/compose.registration.json up --detach --no-deps --no-build --pull never postgres-test
if ($LASTEXITCODE -ne 0) { throw 'STOP: creation/start failed; no automatic cleanup or retry' }
```

Never use an old PASS or change env/policy/template after collection. The collector
checks its own 30-second freshness; the elapsed launch check is an additional bound,
not an extension. Any concurrent resource operations or delay require STOP/recollection.
There is no atomic namespace reservation; retain exclusive operational control.

## 6. Why application services are excluded

The command names only postgres-test, uses --no-deps, no --profile and no overrides.
PostgreSQL has no depends_on or published host port. backend/frontend/mailpit/mailpit-ui
all have registration-after-schema-approval profiles. The existing gate locks the
exact template. Docker documents selected-service/profile behavior and --no-deps:
https://docs.docker.com/compose/how-tos/profiles/
https://docs.docker.com/reference/cli/docker/compose/up/

Read-only Compose 5.6.0 validation without interpolation renders ALL services and
warns that service filtering is not applied. This is not evidence they would start.
Therefore the real-value service-selection check in step 5 must return ONLY
postgres-test. No fake secrets were used to claim that check has already passed.
No up/run/dry-run command was used during preparation.

## STOP conditions

- Draft/unapproved policy, missing scope/permission, unprotected private files.
- Missing, weak, equal or reused secrets; existing secret file; ACL/write uncertainty.
- Context/daemon/platform/tool-version drift requiring independent re-review.
- Missing pinned reference, registry/digest/version mismatch, collector refusal.
- Project-prefix/project-label collision; incomplete/changed/stale inventory.
- Unexpected effective config, profiles, overrides, dependencies or service selection.
- Admission expired, no runtime permission or exclusive control lost.
- Any uncertain creation outcome: no blind retry, reuse, down, cleanup or migration.

Successful empty-cluster creation still authorizes NO SQL connection, user schema,
Phone Harness apply, migration, backend/frontend/Mailpit, email or account action.
Existing finance-security and older test resources remain outside this procedure.
