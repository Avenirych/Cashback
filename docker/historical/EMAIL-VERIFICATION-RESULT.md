# Email verification implementation

Status: EMAIL_VERIFICATION_BLOCKED (live protocol passed; personal-inbox delivery and browser UI verification blocked).

## Customer flow
1. Open http://localhost:3004/register, enter one name, email and password, accept the rules and submit.
2. Open the confirmation message in your email and click Подтвердить почту.
3. Cashback displays Электронная почта подтверждена! and Перейдите в профиль и завершите регистрацию. Click Перейти в профиль.
4. In the original registration tab, Проверить почту fetches the authenticated server profile; it never verifies by itself.
5. For expired/used/invalid links use the resend form; responses do not reveal account existence.

## Current local delivery limitation
Mailpit captures messages locally only. The implementation intentionally does NOT bypass email control or reveal a token through a customer-facing preview. It cannot deliver into a personal mailbox with the current local-only SMTP configuration. A trusted SMTP delivery configuration is required for that manual customer experience.

## Evidence
Backend 5 suites / 38 tests; frontend 4 suites / 54 tests. TypeScript and both image builds passed. Real temporary-account test captured two emails, rotated token on resend, rejected old token, allowed exactly one of two simultaneous confirmations, rejected reuse, and verified actual database token-null/expiry-null booleans. Existing session saw verified=false before and true after. Profile API/page HTTP 200. Browser automation unavailable, so visible navigation remains unverified.

## Preservation
Temporary accounts and their exact messages were cleaned; original user row versions and original three messages unchanged. No schema change, migrations, JWT rotation or unrelated restart. See JSON report for exact current container IDs and changed files. Explicit patch and rollback source are in C:\Users\serge\AppData\Local\Temp\cashback-email-fix-fcd95a21714c4efba17c0d53288ad2ef.
