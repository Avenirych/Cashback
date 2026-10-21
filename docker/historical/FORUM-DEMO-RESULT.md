# Forum and demo bonuses running

Baseline 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7; selectively recovered reference d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f.

## Manual use
1. Open http://localhost:3004/ and log in to Cashback+. Confirm email once using the existing local test mailbox link if required.
2. Open http://localhost:3004/forum/register. Buyer name/email are readonly. Choose a unique forum username, optionally select an avatar and inspect its preview, read the rules and explicitly accept them. No new password or repeat email verification.
3. Submit; expect Регистрация на форуме завершена. Click Перейти на форум. Existing members reenter without duplicate registration.
4. Create topics/replies. Authors display forum username/avatar. In the forum open Обмен бонусами между участниками. The active identity is the logged-in real forum membership, never a selectable alice/bob identity.
5. Demo exchange selects existing confirmed/unexpired credits and transfers them by recipient forum username; history shows sender/recipient forum usernames. It has no monetary value, withdrawals or external payments.

## Applied migration and backup
Exact approved additive SQL committed once, exit 0. Hash cd1b14a5e1b82f6a91feaec0399604825af95cbccbea2c9aef5e874c49f9bbe8. Target cluster 7698666936429441062, database cashback_historical_03573b7, OID 16384. Owner-owned tables; restricted runtime grants verified. No synchronize, automatic migrations or other database changes.
Backup: C:\Users\serge\AppData\Local\Temp\cashback-forum-demo-67ac87e4da804f348d6bfee653bf4b36\historical-before-forum.dump.dpapi. Encrypted with owner-bound Windows DPAPI. SHA-256 of original archive 16a3edf71e7a52f1228d629b261e6bee72a7742fede61cc8cb55dc67764c4a16; pg_restore list and full SQL-generation scan passed. No actual database restore performed. Keep this backup and source proof/patch at C:/Users/serge/AppData/Local/Temp/cashback-forum-demo-67ac87e4da804f348d6bfee653bf4b36.

## Validation
Backend 11 suites / 103 tests, frontend 5 suites / 66 tests PASS. Both TypeScript checks and production Docker builds PASS, existing frontend lint warnings only. Actual served JS contains forum completion/continue controls, demo notice and shared API origin.
Real API/DB test: two dedicated accounts confirmed email, required explicit membership consent, rejected unverified and duplicate/case-colliding names, saved user_id and rules timestamp, uploaded/served real PNG and rejected spoofed PNG, created one topic and reply with correct usernames. Seeded only exact demo fixtures; successful 10-credit transfer, persisted recipient credit and username relationships, idempotent replay, conflicting key, expired/pending/spent and self-transfer rejections all passed. CORS includes Idempotency-Key.
All disposable users/memberships/topic/reply/credits/history/avatar/messages were removed in exact dependency-safe order. Original user row versions, memberships and messages preserved. Current counts: users 2; forum_users/bonus_items/bonus_transfers 0.

## Active services and preservation
See JSON for full current IDs. Only historical frontend/backend were replaced. PostgreSQL and Mailpit IDs and start times are unchanged; unrelated containers are unchanged. A new dedicated avatars volume provides persistence. Existing volumes remain intact.

## Limits
Owner performs final visual browser check; no screenshot or browser automation claimed. Demo credits are now empty after requested cleanup; no automatic new-user minting feature was invented. Payment/purchase-spend operation remains unsupported. No production payment integration was loaded.
