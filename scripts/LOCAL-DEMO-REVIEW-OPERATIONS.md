# Local demonstration reviews

This is an isolated, explicitly opted-in local demonstration mechanism, not a second auth system
or a real review publication path. All account/email/password/JWT checks use the existing application.
No moderator/admin is fabricated or granted privileges.

Required backend configuration: CASHBACK_LOCAL_DEMO_REVIEWS=true, HISTORICAL_LOCAL=true,
HISTORICAL_CONTAINER=true, FRONTEND_URL=http://localhost:3004,
DB_NAME=cashback_historical_03573b7, CASHBACK_FORUM_READ_ONLY=true,
CASHBACK_PUBLIC_CONTENT=false and CASHBACK_CONTENT_MODERATION=false.
The actual host ports remain bound to loopback. Missing/unknown flags fail closed.
Frontend: REACT_APP_LOCAL_DEMO_REVIEWS=true, REACT_APP_REVIEWS_MODE=demo.

Only normal registration and authenticated personal forum registration/avatar upload are restored.
No exception permits `/forum/topic`, `/forum/post`, `/forum/reviews`, decisions, sanctions or appeals.
Existing real moderation/pending data are not migrated, approved, copied or changed.
Real FinanceModule remains disconnected. No demo review produces a monetary/bonus transaction.

Demo reviews are stored only in the dedicated `cashback-historical-03573b7-local-demo-reviews`
volume at `/app/demo-reviews`, never PostgreSQL or the avatar volume. Store version 1 requires
every record to be marked demo=true. No email/password/token is stored in this store.
It retains the authenticated account ID, chosen public forum name/avatar, review text, timestamps,
language, rating and hashed request identifiers for 7 days. Account IDs/request hashes are not public DTOs.
The minimum private linkage is needed for ownership, rate limits, idempotency and own-data erasure.

Seven days covers short local demonstration/QA sessions without maintaining a permanent customer
testimonial history. Expired submissions disappear from all reads immediately and are physically
pruned on reads/writes, at startup and by an hourly timer while backend is running (up to one hour
cleanup lag). If the service is stopped, run its startup cleanup before making the store accessible again.
Static fictional examples have no real author/account and are the existing source fixture, not user data.
The carousel selects the latest ten; page two/history retains older non-expired entries. Reaching ten
never deletes an entry. No automatic migration from demo storage to real reviews exists.

Authenticated `DELETE /demo-reviews/mine` erases only the caller's demo records immediately.
For account-erasure maintenance, remove that account's demo records before deleting its account;
the demo store must be included in the operator's erasure checklist. Do not preserve demo snapshots
in long-lived recovery archives. Core account retention/erasure follows its existing separate procedure.

Updates use an exclusive filesystem lock and atomic rename on the dedicated volume. Corrupt stores,
unexpected symlinks, unknown record types or a busy/stale lock fail closed, never trigger automatic
repair or changes to real data. If a lock remains after a crash, stop the exact backend, verify there
is no competing writer and investigate before operator removal; never delete unknown files by name.

Rollback without database migrations: stop the exact new application containers; preserve this demo
volume; restore only a previously verified guarded backend/frontend, with real forum writes closed.
Never restart an unguarded legacy backend, regrant database writes, restore over live data or enable
financial operations as a workaround. Public/real review activation still needs the separate moderation
migrations, appointed operator, privacy governance, secure administrative access and independent appeals.
