# Separate forum restoration — schema approval required

Baseline 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7; reference d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f.

## Findings
Separate membership already exists and requires verified buyer email and explicit rules acceptance. Canonical forum entity/service/controller match reference. Current database forum_users already has all membership columns, unique user_id/username and foreign key to users. No automatic forum enrollment was found.

Current bonus panel is a local demo with alice/bob/charlie/diana. Reference uses real ForumUser identity and authenticated api/bonus endpoints. The historical database lacks bonus_items and bonus_transfers. Do not declare restored bonus integration.

## Prepared, not activated
ForumRegister source now has exact required labels/consent, avatar preview, login/email guard and explicit completion button instead of timer. Current running frontend remains unchanged until the mandatory schema gate is resolved. Source backups: C:/Users/serge/AppData/Local/Temp/cashback-forum-schema-review-639de224bb35b5c2abba9e2a.

## Exact proposed schema change — NOT EXECUTED
File: docker/historical/migrations/20261020-forum-bonus-additive.sql
SHA-256: cd1b14a5e1b82f6a91feaec0399604825af95cbccbea2c9aef5e874c49f9bbe8
Pinned target: database cashback_historical_03573b7, cluster 7698666936429441062, OID 16384, owner cashback_hist_owner.
The SQL adds two enums, bonus_items, bonus_transfers, reference availability/sender/receiver indexes, and a unique lower(username) index on forum_users to prevent ambiguous recipient lookup. It grants only SELECT/INSERT/UPDATE items and SELECT/INSERT transfers to cashback_hist_runtime. Native PG17 UUID function needs no extension.
Preconditions reject existing/partial bonus schema and case-insensitive name collisions. The current 0 memberships have no collisions. All DDL is transactional with bounded lock/statement timeouts. No INSERT/UPDATE/DELETE of existing records, account alteration, DROP or automatic down.

## Required source integration after approval
Recover reference src/bonus/{bonus-item.entity,bonus-transfer.entity,bonus.service,bonus.controller,bonus.module}.ts and frontend BonusesContext/real exchange panel selectively. Do not replace User/Auth/AppModule wholesale or import later phone/first-last-name fields. Wire only reviewed bonus entities/module, keep synchronize/migrationsRun/installExtensions false, and keep exact database/JWT/mail boundaries. Align forum username lookup with LOWER(username). Verify verified-user, membership, ban and idempotency checks. A schema migration alone does not activate the bonus API.

## Validation
Backend 6 suites/42 tests, frontend 4 suites/64 tests PASS; backend/frontend TypeScript PASS. Guarded backend compile PASS. Host frontend compile was blocked by preserved offline child-process guard. A network-disabled Docker compile using the current image dependencies passed (existing warnings), image forum-prepared; not activated. No running container was restarted, no schema or account was changed. HTTP /forum/register and /forum/rules remain 200.

## Runtime test limitation and authorization
Automatic approval review rejected a proposed disposable forum registration/topic/post/SQL-cleanup test as insufficiently explicitly authorized for those mutations. The command did not execute; no test account, membership, topic, post or cleanup was created/executed. Do not bypass or repeat it without explicit approval of those exact operations. No real bonus exchange or browser E2E was verified.

## Later manual checks (after approved activation)
1. Log in to an email-verified Cashback+ account. Open http://localhost:3004/forum/register.
2. Check readonly buyer name/email, choose unique forum name and optional avatar, inspect preview and rules, explicitly accept them.
3. Submit; expect Регистрация на форуме завершена and click Перейти на форум.
4. Existing membership must reenter without duplicate creation; unverified accounts must return to email confirmation.
5. Verify topic/post attribution and real bonus exchange uses that same forum username; do not use demo identities.
