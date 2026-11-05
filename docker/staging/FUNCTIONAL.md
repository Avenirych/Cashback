# Isolated synthetic workflows (not production)

Opt-in overlay: compose.staging.functional.yaml, merged with the original standalone staging Compose.
CASHBACK_STAGING_WORKFLOWS=synthetic-v1 is default-off and valid only for staging, cashback_staging_app/runtime and internal mail:587. Existing demo/read-only/public-content/financial flags remain unchanged. A live DB identity/schema/privilege gate issues the capability before serving requests.

## Operator sequence
1. Run backend typecheck, functional/B01/B04 suites and config/security/functional tests. Never patch financial guards.
2. Review and pin source manifest and exact existing daemon/container/config inventory. Initial empty-engine admission remains initial-only; use functional-admission.sh for the reviewed four-container upgrade and functional-active-admission.sh after activation. Caller supplies an independently recorded manifest SHA256; do not derive the expected pin from untrusted input.
3. Apply only sql/50-functional.sql with ON_ERROR_STOP and expected_system_identifier to the confirmed isolated synthetic DB. It is transactional/idempotent. Never include historical or financial migrations. sql/70-functional-verify.sql is read-only readiness verification.
4. Build backend under a UNIQUE functional image tag, preserve a validated previous immutable image/config before changing any container. The first implementation accidentally reused the common build tag; its recovery and validation are documented in the D: report. Do not repeat that workflow.
5. Use a pinned functional runtime config and replace only staging backend. Roll back backend-only on failed health; never roll back financial data or remove history.
6. Through private HTTPS/mTLS, register only @example.invalid accounts; retrieve verification mail only inside Mailpit's loopback UI/API and confirm via real API. No direct verified-user seeding or JWT forging.
7. A verified synthetic member who explicitly accepted current forum rules can be appointed by sql/60-synthetic-moderator.sql with exact expected_system_identifier and synthetic_email. Runtime cannot execute appointment; schema-owner operator only. Re-running for the same selected account is idempotent. Another owner is refused. Synthetic privacy marker is expressly not production appointment evidence. User passwords/JWTs must never enter SQL arguments, Git or reports.
8. Test ordinary-user denial, pending visibility, moderator publish, self-moderation rejection, cross-account appeal denial and financial deny. Restart only staging services and verify account/content persistence. Mailpit's /tmp mailbox is intentionally ephemeral.
9. Remove temporary tester passwords/tokens and client private-key copies from container tmpfs; retain only synthetic application records. CA private keys stay outside app mounts/build context.

## Browser follow-up
No Linux browser was installed by this task. Existing 22 RU/EN/DE/FR React tests pass; they do not establish deployed full-browser E2E. A future approved Linux browser/Playwright client must have reviewed pinned package/image, bounded RAM/CPU/tmpfs, no public debug port, no historical data mounts and no Windows security changes. Trust only staging CA in its isolated profile, present synthetic client certificate, verify hostname/CRL, and check language switching, persistence, consent and absence of mixed/localhost URLs. Never use ignoreHTTPSErrors, --insecure or a global CA import.
