# Prepared frontend functional staging revision — NOT ACTIVATED

The current running staging and its independent admission pin remain unchanged.
The frontend build opt-in STAGING_WORKFLOWS=synthetic-v1 is paired with backend
CASHBACK_STAGING_WORKFLOWS=synthetic-v1 by validate.cjs. Default builds stay disabled.
DEMO_ONLY and all financial guard flags remain unchanged. Production cannot obtain
this capability; no JWT/static role/frontend flag grants it.

GET /forum/staging-access requires JwtAuthGuard, no-store, successful existing live
DB identity/schema/financial-privilege gate, synthetic verified account, publication
readiness and current DB forum membership/role. It executes a read-only transaction.
Its response grants no new authority: mutations re-check their existing RBAC and limits.
Runtime cannot appoint a moderator or update appointment tables. No SQL/grants added.
Frontend binds response to current authenticated user/token; HTTP/network failures,
unknown profiles, malformed permissions and token rotation close the forms. Topic and
post writers use the same publication capability. Functional staging hides bonus exchange.

Before any activation:
1. Obtain legitimate login access to the ALREADY appointed synthetic moderator. The
   previous one-time credentials/session were intentionally removed. Do not forge JWT,
   read app signing secrets to impersonate it, appoint another owner or weaken SQL60.
   Existing auth API has no password recovery operation. An owner must either arrange
   existing credentials in a protected guest tmpfs (never chat/report/Git), or separately
   authorize a bounded credential reset of only that existing synthetic moderator with
   exact isolated DB/system-identifier checks. No role/grant/owner change is needed.
2. Review frontend-functional.sha256 as a PREPARED source manifest, not apply authority.
   Repeat typechecks, B04, configuration, frontend authorization and language suites.
3. Run unchanged current active admission with independently recorded original pin.
   Build backend/frontend only inside Alpine using unique tags; preserve current immutable
   images/runtime configuration for service-only rollback. Do not reuse common image tags.
4. Validate exact new image IDs against the reviewed build artifacts. Apply only those
   image references to a reviewed copy of the existing isolated runtime specification;
   compare every other service setting and secret/volume/network binding. Recreate ONLY
   backend/frontend using --no-deps, not PostgreSQL/mail. Do not auto-apply this document.
5. Run read-only DB/role/data verification, quotas, TLS/mTLS, health and financial deny.
   Record exact new backend/frontend IDs and configuration hashes. Update active source
   manifest + exact policy pins only after reviewing differences; retain the unchanged
   PostgreSQL/mail IDs and privileges. Never blanket-accept observed config drift.
6. Run sandboxed strict-TLS/mTLS E2E with ordinary synthetic author and existing moderator:
   registration/verification/login/logout, forum membership/topic/post/review, pending
   visibility, moderator publication/display, ordinary/anonymous decision+queue denial,
   self-moderation refusal, RU/EN/DE/FR, financial403. Do not substitute API mocking for UI.
7. Remove only temporary E2E client and tmpfs credential copies. Re-run active admission,
   four healthy services, Windows3004/3006 and historical PG. Report actual results.

Current blocker is legitimate moderator authentication, not missing financial powers.
No new password-reset API, moderator appointment privilege or B04 exception is prepared.
Production NO-GO.
