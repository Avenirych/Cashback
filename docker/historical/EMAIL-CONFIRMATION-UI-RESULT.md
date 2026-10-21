# Local email confirmation UI

EMAIL_CONFIRMATION_STILL_BLOCKED — source activated and real protocol passed; visual browser verification unavailable.

Confirmed defect: messages were captured in Mailpit, but the previous registration UI offered no local inbox link. Added prominent confirmation heading, honest local-only mailbox instructions and Открыть тестовую почту guarded by exact development/origin/API match.

Manual local flow: open http://localhost:3004/register; register with one name; click Открыть тестовую почту; open the message for your address and click Подтвердить почту; the /verify-email route confirms the token and offers Перейти в профиль. In the original tab click Проверить почту to refresh real server status.

Tests: frontend 4 suites / 62 tests, typecheck and Docker build passed. Actual served JS includes new controls. Live disposable account: two messages captured, token rotated, single-use atomic confirmation and replay rejection verified in real PostgreSQL, authenticated status changed false to true, profile API and page responded. Temporary account/messages cleaned; original 2 users and 6 messages retained.

Only frontend replaced. Backend, PostgreSQL, Mailpit and unrelated containers unchanged. No schema changes. See JSON for exact IDs and rollback archive. No real browser/screenshot was available; actual prior manual click failure and visual fix remain unverified.
