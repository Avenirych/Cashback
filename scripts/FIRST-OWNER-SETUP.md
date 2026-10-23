# First owner: operator-only, not yet executed

This source procedure does not authorize deployment, database migration or an appointment.
No default email, default password, fabricated moderator, HTTP bootstrap endpoint or startup grant exists.
The owner is the intended sole permanent moderator; no current account is assumed to belong to them.

## Demo configuration (future authorized release)

- Frontend `REACT_APP_REVIEWS_MODE=demo` (also the default for absent/unknown values).
- Backend `CASHBACK_PUBLIC_CONTENT=false`; no public content submission is accepted by the moderated service.
- If the new schema is not installed, keep `CASHBACK_CONTENT_MODERATION=false` and use the existing
  `CASHBACK_FORUM_READ_ONLY=true` barrier to prevent legacy forum writes. A frontend flag alone is no protection.
- Demo uses only the ten explicitly fictional localized examples in `demoReviews.json`, with no API fetch,
  ratings/statistics contribution, author accounts or submission CTA. Never insert these examples in PostgreSQL.
- Public mode is explicit, never falls back to fictional examples, and the existing submission page
  checks `/forum/reviews/config`. Direct API submissions are independently gated server-side.
- These are proposed release settings, not changes to running services. Public main-account registration
  is a separate existing feature; this work does not disable it or claim it is ready for a real public launch.

## Prerequisites for a separately authorized first setup

1. Review current source diff and prepared moderation/privacy/retention/role-fence migrations.
   The additional `20261025-owner-bootstrap.sql` creates the one-time marker and grants SELECT only
   to the versioned restricted runtime. It provisions no account or moderator. It is not applied here.
2. Preserve existing pending records. No bootstrap command publishes or changes a content case.
3. Owner creates their own real account through normal registration, verifies a mailbox they control,
   registers for the forum and personally accepts current rules. Do not reuse an unidentified demo account.
   Mailpit verifies a demo flow only; it does not establish control of a real external mailbox for launch.
4. Use a closed operator-only maintenance window: enable compatible moderation internally with public
   content still false. Rules acceptance remains available through normal authenticated routes.
   Global forum read-only blocks rules acceptance and moderator decisions too; do not remove it on open ingress.
5. Before exposing admin/moderation operations, provide HTTPS, protected operator access with MFA
   (for example an authenticated MFA gateway with no direct backend bypass), login abuse controls,
   a strong unique owner password, protected signing key and a session-revocation procedure.
   Existing application auth uses bcrypt + expiring JWT + database user lookup + verified/current-rules
   membership and server-side role lookup. It has no built-in MFA or moderator-specific login throttler.
   Those missing protections are public-launch blockers, not satisfied by an environment checkbox.
6. Owner reviews the actual privacy/retention duties and accepts responsibility in a final document stored
   on D:. Include request channel, deletion/appeal/finite-hold procedures, retention purposes, review dates,
   authorized maintenance executor and an absence/escalation plan. Do not appoint a statutory DPO implicitly.
   Runtime/moderator credentials never receive database-owner/erasure-function privileges.

## Offline bootstrap

Prepare a non-secret approval JSON on D: with these fields (replace placeholders, never copy secrets here):

```json
{
  "accountId": 0,
  "database": "cashback_historical_03573b7",
  "clusterId": "7698666936429441062",
  "privacyDocumentSha256": "REPLACE_WITH_LOWERCASE_SHA256_OF_APPROVED_DOCUMENT",
  "confirmation": "APPOINT OWNER REPLACE_WITH_ACCOUNT_ID AND ACCEPT PRIVACY DUTIES"
}
```

Use a protected operator session with PG connection variables supplied securely. Do not place passwords
in command arguments, reports or shell history. Database table-owner credentials are required offline;
the web runtime cannot use the tool. Verify database/host/port independently and target only the authorized cluster.

```powershell
node scripts/bootstrap-first-owner.cjs 'D:\Cashback+ archive\owner-approval.json' 'D:\Cashback+ archive\approved-privacy-duties.md'
# Default is dry run: transaction rollback, no appointment.
# Only after separate explicit authorization:
node scripts/bootstrap-first-owner.cjs 'D:\Cashback+ archive\owner-approval.json' 'D:\Cashback+ archive\approved-privacy-duties.md' --apply
```

The tool checks the document SHA256, explicit account-specific confirmation, target database/cluster,
schema v3, table ownership, unused bootstrap marker, empty moderator registry, email verification,
forum membership, no legacy ban and current rules. A global transaction advisory lock and locked marker
serialize concurrent bootstrap attempts. Appointment and consumed marker commit together or both roll back.
The marker retains a minimal owner account link; deleting that account clears it and disables readiness.
It is not a public secret/token and must not be reset for retry. A failed transaction before commit can retry;
an uncertain commit must be inspected read-only, never followed by a marker reset.
An authorized database owner can alter the database: this is not protection against a compromised DBA.

## After appointment (still no automatic public activation)

- Re-read marker, moderator registry and current membership under authorized operator access.
  `scripts/verify-first-owner.sql` provides a read-only operator check of the exact target,
  owner ID/document hash/current eligibility and absence of runtime appointment privileges.
  Require both output booleans to be true; HTTP 200 is not appointment evidence.
- Test own normal login, email verified status, current consent, queue access, revoked/deleted-user rejection,
  privacy document hash and correct account link. Tool output alone does not prove MFA or mailbox ownership.
- Keep `CASHBACK_PUBLIC_CONTENT=false` until the five legacy pending items have individual recorded
  review decisions or documented holds. Never auto-approve them. No demo example becomes a real review.
- `CASHBACK_PUBLIC_CONTENT=true` additionally requires the appointed owner to remain an active verified
  moderator, not banned, with current consent and a recorded privacy appointment. Missing table, access
  failure or no eligible owner yields disabled configuration/503 submissions, not a permissive fallback.
- A single moderator cannot resolve appeals against their own decisions, and cannot moderate their own
  content. Existing independence guards remain. Arrange an independently authorized occasional appeal
  reviewer, or approve and implement another compliant process in a separate task before public activation.
  Do not give the owner a hidden bypass or automatically add a second permanent moderator.
- Test the new migration, real one-time/concurrent bootstrap and runtime permissions in isolated PostgreSQL
  before deployment. Unit mocks do not prove PostgreSQL locking/grants. No such migration/test is run on live DB.
- Finally obtain separate release authorization and run the existing backup/restore/deployment/rollback plan.
  No GitHub push, production migration or deployment is implied by preparing this procedure.
