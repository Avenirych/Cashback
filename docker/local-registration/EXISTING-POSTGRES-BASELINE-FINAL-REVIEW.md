# Existing PostgreSQL baseline candidate review

Candidate: `existing-postgres-baseline.policy.candidate.json`.
Status: CANDIDATE_NOT_APPROVED; deliberately rejected by the baseline CLI until
the independent approval process is completed. No runtime policy has been changed.

## Evidence and comparison

All seven fields were transcribed from the user's OBSERVED_NOT_APPROVED report.
Container ID and template hash match the previous proposal. Its five nulls are
now populated with user-reported observations, not newly collected or independently
approved facts. All seven values have the required lowercase 64-hex format.
The four base fields match both the prior proposal and owner-policy.draft.json.
The actual protected approved policy was not read or modified; equality against
that file must be checked by its authorized owner before applying the change.

The source template's canonical hash is rechecked locally against TEMPLATE_SHA256
and both supplied Compose hashes. Their equality is consistent with normalization
recovering the source representation in no-interpolation mode. It does not prove
runtime credentials, SQL identity or current live resource state.

Source PostgreSQL configuration: image is the required REGISTRATION_POSTGRES17_IMAGE
placeholder, with no fallback; approved base image is the exact pinned manifest.
Single named volume `registration-pg17-data` resolves to the expected project
volume and mounts at `/var/lib/postgresql/data` with nocopy. PostgreSQL joins only
the internal `database` network with the exact expected full name. It publishes
no ports and has no additional bind mounts. Healthcheck uses pg_isready; the source
has no-new-privileges. Other source services are behind the explicit later-phase
profile; the complete template includes later application/mail networks, which
is not evidence that they exist in this PostgreSQL-only project. The future
authority/helpers topology is not activated by this policy.

The user's completed observation block checks local image Descriptor digest and
platform, container labels and healthy state, exact volume/mount, only PostgreSQL
as network peer, no host-port publication, no extra resources in this project and
stable render/resource observations. This review relies on the reported successful
execution of that block. Raw runtime configurations are not present here: hashes
cannot be inverted to independently inspect image, mounts, capabilities or ACLs.
No claim of a fresh live baseline PASS or SQL cluster identity is made. Inventory
9 containers / 9 networks / 4 volumes is reported context, not fresh authorization.

## Independent approval and application

1. Independent owner/reviewer checks the actual approved policy's four original
   fields against this candidate. Any difference means STOP; never overwrite it
   with draft values. Review the exact seven assertions, the observation report,
   source Compose and the actual configuration through an authorized review
   channel without disclosing Config.Env. No fingerprint recollection is requested
   merely to prepare this candidate; final baseline execution necessarily performs
   its own fresh observations.
2. Owner explicitly approves this exact baseline scope, values and hash definitions
   through the existing protected-file trust process. The CLI does not verify an
   Ed25519 approval signature: provenance is the independently reviewed protected
   policy file. Changing a status string is not independent approval. This task
   issues no signature, receipt, fingerprint approval or phase approval.
3. After separately authorized application, the owner updates the protected policy
   with existingPostgresBaseline while preserving the four base fields and any
   other existing assertions. If a top-level status field is present, the current
   CLI requires APPROVED. Never deploy this unapproved candidate directly. Preserve
   the protected file's ACL and review the exact resulting diff; do not put secrets
   in the candidate or a Git file. No command to write the protected file is provided.
4. Run the Docker-only baseline CLI below against that actually approved path.
   Any drift, incomplete evidence or protected-resource change means STOP. Do not
   automatically revise approved hashes to match an observation.

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
$dockerCli = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$approvedPolicyPath = Read-Host 'Full path to independently approved owner policy'
if (-not (Test-Path -LiteralPath $dockerCli -PathType Leaf)) { throw 'STOP: Docker CLI unavailable' }
if (-not (Test-Path -LiteralPath $approvedPolicyPath -PathType Leaf)) { throw 'STOP: approved policy missing' }
node --use-system-ca -r ts-node/register docker/local-registration/existing-postgres-baseline.ts "$approvedPolicyPath" --docker-cli "$dockerCli"
if ($LASTEXITCODE -ne 0) { throw 'STOP: PostgreSQL baseline BLOCKED' }
```

Expected success: POSTGRES_BASELINE_VERIFIED, not creation or service authorization.
Candidate input before approval: BLOCKED / POLICY_INCOMPLETE. SERVICE_ADMITTED and
APPLY_ELIGIBLE remain false, PHONE_APPLY_CONCURRENCY_VERIFIED remains false and
CREATION_AUTHORITY_NOT_PROVISIONED remains a separate blocker. No SQL, migration,
provisioning, Docker mutation, authority issuance or automatic application occurs
as part of preparing this review.
