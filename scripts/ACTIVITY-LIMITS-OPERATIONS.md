# Activity limits and anti-abuse operations

This is a local demonstration release, not public-launch or legal certification.
The financial module remains disconnected. No purchase count or general cashback
cap is added. No browser request can confirm a real partner reward.

## Configuration and deployment

Apply `20261026-activity-limits.sql` only as the verified database owner after an
up-to-date D: logical backup has been restored and checked in an isolated database.
Then apply `20261026-activity-limits-grants.sql` with the exact verified runtime role.
These additive tables do not alter baseline columns, balances, forum content or
existing financial tables. Do not run synchronize or automatic migrations.

Backend `CASHBACK_ACTIVITY_LIMITS=true` requires schema version 1 at startup.
Frontend `REACT_APP_ACTIVITY_LIMITS=true` displays authenticated usage. Existing
demo-only, read-only forum and disabled real-content/finance flags stay unchanged.

The database owner changes `activity_limit_policies` in a reviewed SQL transaction;
the application reads policies on every reservation. The runtime role cannot change
policies or assign plans. `enabled=false` or `maximum=NULL` disables that individual
rule. Partner rules add stricter restrictions; they cannot bypass the global rule.
Example: a partner video/day maximum 20 supplements the global 50/day. Changes need
no source edit or rebuild. Configuration changes must preserve partner contracts.

UTC determines all day/month boundaries. Failed-login checks also inspect the
preceding rolling 15 minutes, including pending attempts, across quarter boundaries.
Defaults: video 50/day and 1500/month; research 5/day and 100/month; reviews 3/day;
topics 5/day; posts 30/day; failed login 5/15 minutes. Independent existing real
moderation eligibility, sanctions and one-real-review-per-account rules still apply.

Security counters use a keyed account pseudonym plus an account/source pair. A shared
IP alone never creates an account fraud sanction. The source is the direct socket
peer; behind NAT or a reverse proxy it may be shared. Untrusted forwarded headers
are ignored. Public proxy deployment needs a separately reviewed trusted-proxy setup. A global registration request
capacity of 60/minute protects resources independently of IP; per-identity 5/day and
existing unique email/verification checks remain. Sensitive authenticated write APIs
have a configurable 60/minute cap. These controls are not a proof of personhood;
distributed disposable identities require a future verified challenge/partner adapter
before public launch. Do not silently add CAPTCHA bypasses or create moderators.

## Atomic operations and failure handling

Usage and reservation/confirmation/cancellation are PostgreSQL transactions under
per-subject/action advisory locks, unique operation keys and nonnegative counters.
The quota includes both used and pending units. Changing an idempotency key's material
is rejected. Demo and real usage have independent namespaces. Historical demo rows are preserved;
new counters apply to actions accepted after activation rather than fabricating
retroactive rewards or rewriting historical records.

Real moderated content reserves and confirms inside its existing content transaction.
Legacy unmoderated writes fail closed when activity protection is enabled. Existing
moderation burst guards are retained. Local demo reviews retain their separate
file/volume store: a durable committed quota reservation precedes the idempotent
atomic file write. A known no-write failure releases it after a successful store
probe. An uncertain storage/DB outcome retains the reserve; retrying the same key
recovers and confirms the same file record instead of accepting a duplicate. Never
release an ambiguous pending real reservation just because a timer elapsed.

Demo video/research quota tests are authenticated, verified-user operations with
idempotency keys and no amounts or partner-confirmation fields. Animation completion
checks the demo quota before updating its historical browser-only counter. Aborted
animation does not call completion. A network-uncertain completion can consume a
quota unit without updating that browser counter; profile usage is authoritative.
This never changes a real balance or the separate forum bonus exchange.

No real partner is configured. `PartnerActivityContract` defines exact-body HMAC,
timestamp verification, a private server proof, provider-scoped unique event IDs,
replay/conflict detection and atomic settlement. It has no public HTTP confirmation
route. A future adapter must authenticate its provider before invoking it. Failure
releases a pending reserve; reversing an already completed action does not fabricate
a financial reversal or refill its activity quota. Financial refund/correction
rules remain in the isolated financial implementation and are not activated here.

## Privacy, appeals and access

Security events contain only a keyed pseudonym, bounded event kind and timestamps;
never raw IP/email, passwords, verification/session tokens or request payloads.
`CASHBACK_SECURITY_RETENTION_DAYS` is 1–90, default 30. Startup/hourly cleanup removes
expired events unless necessary for an open appeal. Account/source linking uses
domain-separated HMAC with the existing server key; rotating that key changes the
pseudonymous security namespace. Do not rotate it casually to reset counters.

Appeal reasons are separately stored, 10–1000 characters, at most one open appeal
per account, with user ownership/FK cascade. Do not request passwords or sensitive
documents in reasons. Only the existing verified, active, non-banned, explicitly
bootstrapped owner with privacy acknowledgement can access events/appeals and resolve
them. No fake staff is provisioned. An unappointed installation can collect local
test appeals but cannot claim human review has occurred.

Opening/resolving appeals and cleanup share a transaction lock. Open appeals retain
their relevant events. Resolution extends relevant event retention by the configured
period; resolved appeal reasons are removed after that period. The appointed privacy
owner must review open cases at least monthly, document any continuing necessity and
resolve/anonymize cases when no longer needed. Open status is not a justification for
indefinite retention by technical immutability; these tables are deliberately mutable.
Handle deletion requests through the existing owner-controlled verified account
deletion procedure; foreign keys cascade personal operations, plans and appeals.
Pseudonymous event records then age out under the documented retention rules.

Expired demo/security operations are cleaned after 90 days. Stale security holds
older than a day and expired demo holds older than eight days can be released; demo
review content expires after seven days. Pending real operations and unique provider
evidence must not be purged automatically without a provider-specific reconciliation
and retention policy. No connected real partner exists in this release.

## Rollback

Build and validate both replacement images before stopping exact current services.
Keep their existing images/configuration and avatar/demo mounts. Apply only the new
activity migration and grants. Verify startup schema check, anonymous 401s, ownership,
3/day demo review limit, login rolling window, 50/1500 video limits and normal auth.

The schema is additive. Prefer fixing forward or keeping the new backend safely
read-only if a critical fault occurs. Do not drop new quota/event tables to roll back;
that destroys evidence. A previous backend lacks the new caps: it is not an approved
writable public fallback. Keep real forum/financial writes disabled, do not switch
to an unguarded legacy backend, and never restore over the active database without
separate destructive-restore authorization. No public launch or GitHub push.
