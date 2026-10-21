# Marketing preferences and collapsed Wise notice

Status: MARKETING_PREFERENCES_WISE_READY

Recovered d14f76e9 MarketingPreferencesModule, service/controller/DTO/entity, frontend panel/modal/types, original RU/EN/DE/FR copy. Kept the existing shared BACKEND_URL and JWT identity. Added original bounded backendFetch helper for these restored components only. No second preference API or consent system.

## User journey

Open http://localhost:3004/profile after login. Use the marketing panel's Edit/Изменить button to view/change the three original choices: specialOffers, partnerRecommendations, smsMarketing. All are off without an explicit choice. Save all three off to decline/withdraw. Account/service notifications are shown separately and cannot be disabled through this marketing API. Mandatory site terms and forum rules are separate.

On /register the form explains optional marketing separately from site terms. After account creation, the authenticated email-confirmation screen exposes the same real preferences panel; preferences can also be changed later in profile. No mandatory registration field, password rule, phone rule or email-confirmation contract changed.

Links beside choices lead to the existing Privacy Policy (marketing section and rights/withdrawal section) and Cookie Policy. Existing documents were reused; only stable section anchors were added. No new legal document was invented.

Wise uses native details/summary, collapsed by default. Click or keyboard-activate its existing title to expand/collapse; all original text and external Wise link are retained. Wise account form fields/enrollment were not changed.

## Schema and preservation

Exact target: PostgreSQL cluster 7698666936429441062, cashback_historical_03573b7, OID 16384. The marketing table/module were absent in the active historical application. Created marketing_preferences and its dedicated sequence once with identity/absent-object guards, unique userId, user FK, false marketing defaults and original SMS timestamp/version constraint. Granted runtime only SELECT/INSERT/UPDATE on the new table and USAGE/SELECT on its sequence. No existing table or user row was changed, no auto migrations/synchronization enabled.

Original implementation supports created/updated timestamps and last SMS grant/revoke timestamps/version. Repeated grant preserves its date, withdrawal becomes effective immediately. It did not provide a full append-only history of all marketing channels; none is claimed here. There were no existing marketing rows to migrate because the table was absent.

Verified source archive and DPAPI-encrypted database backup: C:\Users\serge\AppData\Local\Temp\cashback-marketing-1792509197596. Backup SHA-256: eca5721e3fc972c60d560ea8a3b095e454b952d3bc8c6bacf909e6b98f74c7c9. Encryption roundtrip and full pg_restore archive scan passed; no trial database restore was performed. Old images and a rollback Compose file are retained. Do not destructively drop the consent table to roll application images back.

## Validation

109 frontend and 125 backend guarded offline tests passed. Full repository/frontend TypeScript, production frontend/backend builds, syntax and git diff --check passed. The recovered HTTP integration suite was adapted to current types/configuration but NOT executed; guarded tests mock repositories and processes/network remain blocked.

Live disposable-account API/DB test passed: defaults off, explicit grants, independent changes, re-login persistence, stable grant date, withdrawal date and effective false flags, anonymous/cross-user rejection, service-notification flag protection. No marketing messages were sent. Only a local transactional registration-confirmation email was generated. Exact cleanup removed the disposable preferences, account and message. Three original user rows and forum inventory were preserved.

Only historical frontend/backend replaced. PostgreSQL, Mailpit and all unrelated container IDs/images/start times preserved; existing secrets reused. No existing account's marketing choices were edited. The UI was tested in mocks and active JS/HTTP was checked; visual browser verification remains manual.

Exact changed files, live identities and structured proof: MARKETING-WISE-RESULT.json.
