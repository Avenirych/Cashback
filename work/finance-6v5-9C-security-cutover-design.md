# Cashback+ — 6В.5.9-В: DB permissions, authorization freshness и закрытый cutover

Дата: 14.10.2026. DESIGN ONLY. Все DDL/SQL ниже — проект для будущего внедрения, не выполненные команды. Создаётся только этот документ. Production activation, роли, миграции, подключение БД и изменение writers не разрешены данным этапом.

## 1. Основание и фактическое состояние

Изучены BUSINESS_SPEC_6B_FINAL (включая B61–B66), проекты 9A/9B, finance services/entities/migrations, authority interfaces, FinanceModule, src/data-source.ts, test/finance/README.md и run.candidates.cjs. Прежний 8D-контракт учтён через 9A/9B. Приоритет имеют последние решения владельца: effect-based generation, максимум три попытки, отдельные роли, PostgreSQL authority store, полный закрытый cutover.

main; HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9; staging пуст. Известные untracked: src/finance/ и test/finance/. FinanceModule не импортирован AppModule. Providers production default deny. Сервисы и триггеры сейчас выполняют прямой DML; grants/guard/admission/DB authority ещё отсутствуют. Correction/candidate helper требует READ COMMITTED; это сохраняется до отдельного согласованного изменения. Будущий apply SERIALIZABLE не реализуется.

Тестовый runner задаёт postgres-test:5432, роль cashback_test, schema public, synchronize=false/migrationsRun=false, затем проверяет identity перед миграцией. Историческая finance DB: cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77, OID 24780, cluster 7695793866029359141, PostgreSQL 17, server IP 172.18.0.2. Это сведения из файлов, НЕ проверка живого сервера сегодня. Runner installer connection не доказывает runtime permissions. Основной DataSource использует DB_* и fallback cashback/postgres; для finance runtime он непригоден без отдельной конфигурации. Значения секретов не читались.

Исторические 173 unit/53 PostgreSQL passes не проверяли новый boundary. Сегодня тесты/DDL/DB/Docker не запускались. Изучение локальной конфигурации не разрешает подключение или provisioning ролей.

## 2. Безопасностная граница и роли

Рекомендуемые имена ниже логические; конфликт имён существующих cluster roles требует отдельного выбора, не переиспользования неизвестной роли.

| Роль | Разрешено | Запрещено |
| --- | --- | --- |
| finance_object_owner NOLOGIN | Владение защищёнными таблицами и функциями | Runtime membership/credentials; использование как app login |
| finance_installer | В согласованное offline окно устанавливать finance objects, SET ROLE owner для создания; отдельные credentials | Присутствие в runtime pool/artifact; обычные доменные операции |
| finance_runtime | CONNECT finance DB, USAGE finance_api, EXECUTE точного allowlist команд/читателей | Table DML/SELECT для decision, TRUNCATE/COPY FROM/TRIGGER/REFERENCES, DDL, ownership, owner/installer membership, произвольные helpers |
| finance_authority_writer | Только узкие операции trusted identity/grant/revoke/attestation | Свободный DML authority store, ledger/lot bypass, выдача себе прав |
| finance_deployment_controller | Закрыть admission; открыть после проверенного manifest/приёмки | Денежные операции, изменение grants участника, generic SQL |
| finance_fixture (только изолированные тесты) | Подготовка синтетических fixtures при CLOSED | Production роль/artifact; конкурентный обход работающего runtime |
| Фоновые процессы | Своя runtime identity и ограниченный список функций | Installer credentials, blanket EXECUTE; несуществующий worker не активируется |

Все LOGIN-роли обычные: NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS. NOINHERIT само по себе не запрещает SET ROLE: runtime не имеет прямой/транзитивной membership owner/installer, включая SET/ADMIN options. Отдельно проверять pg_auth_members, effective privileges, PUBLIC grants, predefined elevated roles и database/schema ownership. NOLOGIN owner не защищает от member с SET ROLE. Superuser/installer остаются административной доверенной границей: гарантировать защиту от DBA данным дизайном невозможно; их действия должны быть offline и аудируемы.

### DDL-псевдокод boundary

```sql
-- Только отдельно разрешённое cluster provisioning, не обычная table migration.
CREATE ROLE finance_object_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE finance_installer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE finance_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
-- LOGIN identities/provisioning/секреты устанавливаются отдельно; здесь паролей нет.
-- Installer credential получает только контролируемую возможность SET ROLE owner.
BEGIN;
-- Под CLOSED, без старых writers. Не переносить legacy tables/не менять main DB.
CREATE SCHEMA finance_api AUTHORIZATION finance_object_owner;
CREATE SCHEMA finance_security AUTHORIZATION finance_object_owner;
REVOKE ALL ON SCHEMA finance_api, finance_security FROM PUBLIC;
GRANT USAGE ON SCHEMA finance_api TO finance_runtime;
-- Existing finance_* остаются public: schema-qualified ссылки, exact object list.
-- Для каждой защищённой таблицы и принадлежащей ей sequence:
ALTER TABLE public.finance_funding_lots OWNER TO finance_object_owner;
REVOKE ALL ON TABLE public.finance_funding_lots FROM PUBLIC, finance_runtime;
-- Аналогично ВСЕМ finance tables, не ALL TABLES public (там могут быть legacy).
ALTER DEFAULT PRIVILEGES FOR ROLE finance_object_owner
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE finance_object_owner
  REVOKE ALL ON TABLES FROM PUBLIC;
-- Repeat для каждого фактического creator role; defaults не исправляют старые ACL.
-- CREATE/REPLACE функций + REVOKE PUBLIC + exact GRANT в одной transaction.
COMMIT;
```

Runtime не получает CREATE в любой схеме search_path или ownership DB; TEMP не нужен. Если PUBLIC даёт CREATE/TEMP/CONNECT в shared test DB и их нельзя убрать без воздействия на других пользователей, это deployment blocker: нужен отдельно утверждённый scope либо отдельная permission-test DB. Не менять публичные права shared cluster/legacy молча. Проверять фактическую LOGIN identity, не только NOLOGIN group. Привилегии ролей кластерные; grants ограничиваются однозначно идентифицированной finance DB. Перед provisioning требуется отдельное разрешение места/масштаба, не production.

Защищены accounts/journals/postings/outbox, receipts/lots, bank operations/observations/decisions/reviews/events, mandates/targets/reservations/allocations, classification roots/parts/requests/decisions/candidates, новые controls/admission/auth tables. Runtime raw SELECT также закрыт для чувствительных state/proofs; scoped history только через функцию. Нельзя выдавать общее EXECUTE ON ALL FUNCTIONS, generic post_any_accounts, owner helper, migration/fixture entrypoint. Проверять views, procedures, overloads, sequences и callable цепочки, а не только table ACL.

### Approved entrypoint

```sql
CREATE FUNCTION finance_api.reserve_synthetic_coverage(
  p_context_ref uuid, p_command_key text, p_command jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, finance_security, pg_temp AS $$
BEGIN
  -- exact payload schema; auth identity НЕ из p_command.
  -- begin_guard -> current authority -> ordered resources -> domain predicates
  -- typed internal mutation -> effect bump -> deferred checks -> historical result
  -- все table/function names schema-qualified, no arbitrary SQL identifiers.
  RETURN finance_security.reserve_checked(p_context_ref,p_command_key,p_command);
END $$;
ALTER FUNCTION finance_api.reserve_synthetic_coverage(uuid,text,jsonb)
 OWNER TO finance_object_owner;
REVOKE ALL ON FUNCTION finance_api.reserve_synthetic_coverage(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finance_api.reserve_synthetic_coverage(uuid,text,jsonb)
 TO finance_runtime;
```

Функция не COMMIT/ROLLBACK; вызывается в активной внешней transaction и сохраняет атомарность domain/ledger/outbox. Definer повышает SQL privilege, но НЕ доказывает identity/evidence. Запрет dynamic SQL, untrusted schema lookup и произвольной передачи actorId/participantId как доказательства. Проверка schema/signature до вызова, NULL не должен обходить checks. Runtime может вызвать разрешённый SELECT функции напрямую: это утверждённый механизм, который полностью проверяет predicates, не обход.

Функции owner-private (bump/ledger/proof helpers) runtime не EXECUTE. Trigger/GUC marker не является boundary: runtime может подделать GUC. ACL + narrow validated function body обязательны. CREATE OR REPLACE сохраняет ACL, поэтому каждый deployment проверяет полный allowlist. Рекомендации основаны на [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) и [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

## 3. Минимальное доверенное хранилище авторизации

Проект таблиц в finance_security (не новые бизнес-балансы):

```sql
CREATE TABLE finance_security.authority_state (
 id smallint PRIMARY KEY CHECK(id=1), epoch bigint NOT NULL CHECK(epoch>0),
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE finance_security.principals (
 id uuid PRIMARY KEY, participant_id uuid, verified boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT false, identity_version bigint NOT NULL CHECK(identity_version>0)
);
CREATE TABLE finance_security.grants (
 id uuid PRIMARY KEY, principal_id uuid NOT NULL REFERENCES finance_security.principals,
 action text NOT NULL, scope_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
 active boolean NOT NULL DEFAULT false, UNIQUE(principal_id,action,scope_id)
);
-- Context records: trusted issuer, principal, exact LOGIN binding, audience,
-- expiry, revocation, issuer version; runtime cannot mint/update or enumerate.
-- Immutable authority audit: commandKey + fingerprint + before/after epochs.
```

Обязателен доверенный producer identity/grants/context. Переданный UUID выбирает существующий контекст, но не доказывает владение им. Для shared app LOGIN нужен аутентифицированный сервером контекст (проверяемая capability, связанная с issuer/principal/audience/login); runtime не вправе mint/менять owner record. Альтернатива — отдельные authenticated DB LOGIN principals с session_user mapping. Конкретный способ credential/capability binding остаётся deployment decision; до доказанного binding enabled=false. current_user внутри definer — owner, не caller; использовать проверенную session_user/login binding. Не логировать bearer evidence.

Service principal привязан к ответственному participantId, действию, scope, context и environment; смена технического аккаунта не меняет независимость участника. Нет verified participant -> deny. Evidence roles/classify_source/coverage mandate не предоставляют correction rights. Synthetic issuer разрешён только тестовой конфигурацией вне production artifact. Trusted authority writer не принимает self-asserted role/participant/банк-доказательство; producer policy отдельно проверяется. Недоступность/disabled/missing identity/proof/grant/corrupt epoch -> fail closed.

### Freshness и линейная точка

Все финансовые commands и grant/identity/context revoke сначала берут один global advisory xact lock (726405,0), затем admission fence и authority fence. Они держат их до outer commit. Auth проверяется ПОСЛЕ fences внутри этой transaction, не из JWT/cache. Predicate state читается после актуализирующего guard statement.

В READ COMMITTED после ожидания новый statement видит committed revoke. В SERIALIZABLE/REPEATABLE READ старый snapshot не обновляется advisory lock: необходим конфликтующий UPDATE fence. Unsupported REPEATABLE READ отклоняется; SS старого snapshot получает 40001. Проект authority fence — `UPDATE authority_state SET epoch=epoch WHERE id=1 RETURNING epoch,enabled`; создаёт конфликтующую row version, но не повышает semantic epoch. Revoke реально повышает epoch, меняет grants/identity/context и пишет audit в одной transaction. Fence MVCC version не lot generation и не финансовая проводка.

Линейная точка отзыва — успешный COMMIT revoke transaction. Если command первым получил gate, revoke ждёт её commit/rollback: операция допустима по прежнему состоянию; отзыв не ретроактивен. Если revoke commit первым, новая command отказывает; SS stale attempt abort/retry и затем отказывает. Отзыв не считается вступившим в силу при начале запроса или получении lock. Для срочного operational shutdown остановить admission/активные sessions отдельной процедурой, не отменять историю.

Auth writer, вне зависимости от finance admission CLOSED, разрешён только узким trusted authority API, тем же gate/fence; direct DML закрыт. Нельзя ждать network authorization/bank API под locks. Не требуется доверять cache после refresh: store — current authority truth. Доставка изменений внешним IdP с задержкой требует явно определённой границы: DB commit отзыва является гарантируемой точкой; пока freshness относительно внешнего отзыва не доказана, production deny.

## 4. Guard, lock order и изоляция

Проект: `finance_protocol_state(id=1, protocol_version, mode CLOSED|ENFORCED, manifest_hash, fence)` и `finance_lot_control_versions(lotId PK/FK, generation bigint CHECK>0, fence bigint CHECK>0)`. Generation semantic; fence для conflict detection может получать same-value UPDATE. Суммы/blocked/capacity не дублировать. Отдельный fence предпочтителен generation=no-op, чтобы trigger semantic bump невозможно было перепутать с snapshot safety. Overflow increments -> rollback.

Точный порядок для всех команд и DB functions:

1. Global admission/auth advisory lock (726405,0).
2. Protocol row conflicting UPDATE fence, проверка mode/protocol/manifest. Затем authority row conflicting UPDATE fence и trusted context/principal/grants, в фиксированном порядке. Grant revoke следует этому же порядку.
3. ВСЕ bank scope advisory keys 726404, затем ВСЕ identity keys 726403. Sort/deduplicate по фактическим namespace/key, не только исходным строкам.
4. Только approve branch: все observation rows sorted; затем все canonical operation rows sorted FOR UPDATE. Нельзя после operation брать observation lock; прочие ветви используют immutable discovery.
5. ВСЕ существующие lot rows UUID sorted FOR UPDATE; затем ВСЕ control rows sorted, mandatory existence и conflicting UPDATE fence. Проверить semantic generation и operation versions заново.
6. Branch rows: mandate→target→reservation/allocations; либо receipt→root/parts→request→candidate→decision. В каждом уровне stable sorted IDs; combined command собирает весь набор заранее.
7. При денежном journal: все ledger keys 726402 sorted, затем accounts sorted. Metadata не берёт accounts и не создаёт journal/outbox.
8. Mutation/effect mapper authoritative bump, deferred invariants, outer commit.

Discovery не принимает решения; неожиданная mapping/ресурс, требующий lock более раннего ранга, -> whole transaction abort/replan. Нельзя последовательно резервировать разные targets в outer transaction с поздним дозахватом более ранних locks. Orchestrator заранее собирает closure ресурсов либо одна sanctioned compound function; иначе fail closed. FK/deferred/trigger locks должны быть внесены в manifest; trigger не вводит обратный порядок.

Мутации availability/classification/held coverage/evidence state/корректирующего допуска увеличивают semantic generation; чистая история/telemetry/replay no-op не увеличивают. Conservative deny при неизвестном влиянии. Request/candidate/decision, меняющие admissibility точного независимого рассмотрения, не считать чистым audit. Единственный владелец bump — DB checked mutation helper/trigger; service не делает duplicate increment. Весь version vector и result валидны только до commit текущей transaction, не bearer разрешение будущего использования.

Global gate остаётся эксклюзивным, поэтому снижает throughput, но даёт простой доказуемый order. Нельзя удалять его как оптимизацию без новой спецификации. Row UPDATE guard обязательны даже с ним: advisory ожидание не освежает SS snapshot. Это соответствует [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html). READ COMMITTED/SS тестируются обе стороны ожидания; review/candidates пока RC, SS будущего apply только test probe, без применения.

## 5. Совместимость всех путей

| Путь | Обязательное изменение будущего пакета / сохранённое правило |
| --- | --- |
| Receipt NEW | gate/auth/scope/identity/op -> ledger -> private new receipt/lot/control genesis=1 -> binding; private rows исключение, не поздний захват existing lot после accounts |
| Receipt replay | Fresh trust; revoked -> BANK_EVIDENCE_BLOCKED с existing receiptId; same binding no-op; cash один раз |
| Observe/quarantine | Admission/current authority; нет mapped lot -> no generation bump, не account-wide freeze |
| Approve/verify/bind/revoke/recheck/restore | Precollect mapped lot/control; op version и effects согласованы; revoke не release/сторно; restore не own-free |
| Coverage target/reserve/usability | DB mandate/current auth; all origin/lot controls до branch; capacity/limit атомарны; full amount; replay current blocked, no new allocation |
| Classification/replay | Origin proof/current authority; disjoint ranges и deferred completeness сохранены; no ledger; restricted remainder |
| Correction requests/link/state/review | Distinct rights, trusted participant, ancestry; historical NULL identity fail closed; RC контракт; decision versions/history сохранены |
| Candidates/exact decisions | Exact fingerprints, cross-request uniqueness, legacy reason-only NULL; stale bank approval не пригоден; no apply |
| Ledger/outbox | Internal approved domain command через тот же manager; runtime не generic account writer; post/postWithManager signatures сохраняются, primitive tests через fenced test identity |
| SQL triggers/fixtures/migrations | Полный inventory callable path; никакого live runtime fallback/direct DML. Fixtures CLOSED, installer вне app |
| History/state readers | Guarded current decision reader или явно исторический scoped read; ответ после commit не разрешает действие |
| Future release/reallocate/apply/payout | Не реализуются; обязаны войти в protocol перед появлением |

Review restoration требует новую независимую decision по текущей bank version. Ledger immutable/double-entry/idempotent keys не ослабляются. Простой classification/guard/authority audit не меняет банковский cash. Restricted lots не становятся own-free. B66 M>0/splits/GBP и B64–B65 не меняются; этот этап не признаёт никаких обязательств/доходов/выплат.

Retries: максимум ТРИ attempts TOTAL, один immutable key/fingerprint, whole outer transaction. Только 40001/40P01 и definite abort без внешнего side effect; fresh locks/auth/versions каждую попытку. Commit-time serialization failure тоже обрабатывается. Auth/evidence/capacity/material conflict не retry. 23505 -> read-only exact reconciliation, не blind retry. Unknown commit -> reconciliation перед mutation, не четвёртая попытка. Finite backoff/deadline выбираются при deployment; не ослаблять лимит. При внешнем manager retry выполняет владелец outer transaction; finance helper не retry savepoint/вложенную transaction.

## 6. Закрытый cutover — последовательность

Atomic означает нет интервала активного обходящего writer, а не одну общую SQL/filesystem transaction.

**C0 Inventory:** manifest всех tables/triggers/functions/views/roles/grants/SQL queries/DS/cron/scripts/test/admin paths и effect map. Signed/reviewed artifact digest; unknown writer -> STOP. Проверить exact DB/cluster/OID/env/history и одобрение test-role scope. Не запускать старый migration runner с изменёнными baseline.

**C1 External fence до первой миграции:** остановить все finance processes и producers, запретить новые соединения старых finance identities на инфраструктурном уровне. При общем app credential безопасно отделить finance невозможно только pg_stat_activity filter: требуется maintenance всего использующего его процесса либо отдельная среда. Не отзывать shared main DB permissions. Если dedicated identities/полный drain не доказаны — STOP, никакой частичной установки.

**C2 Drain:** read-only identify sessions/xacts/prepared transactions/locks для exact finance DB/identities. Предпочтительно дождаться commit/rollback; после отдельно согласованного timeout cancel/terminate только идентифицированные finance sessions. Prepared transactions отдельно решить, не blindly COMMIT PREPARED. Idle-in-transaction тоже blocker. Запрещено считать acquisition advisory lock достаточным drain старого SQL bypass. Admission ещё не установлен, поэтому external fence обязателен.

**C3 Offline transaction:** installer берёт gate до DDL; создаёт mode=CLOSED, guard baseline для всех существующих lots, authoritative mutations, current authority enabled=false, narrow functions, ACL/defaults/ownership. Прямой DML старого runtime снимается в этом же пакете. All existing history/money unchanged; no fake participant/backfill approvals. Обычный runtime не имеет EXECUTE open/close функции. Commit остаётся CLOSED. SQL table locks и FK/trigger ordering проверяются при пустых writers; не выполнять concurrent index DDL как скрытое исключение атомарности.

**C4 Artifact:** deploy все adapters/writers/readers одновременно, пока CLOSED. Отдельный finance DS без root dotenv fallback/admin credentials/synchronize/migrationsRun. Старые binaries не получают DML. Runtime function checks expected protocol manifest; закрытые/mismatched callers deny. Все mutation/read-for-action paths в approved DB API, no shadow alternative.

**C5 Acceptance:** внешние процессы ещё fenced. В изолированной finance среде controlled deployment-controller может включить ENFORCED только для заранее привязанного acceptance runtime identity, остальные identities disabled в auth. Проверить всю матрицу настоящим runtime LOGIN без owner membership. Это не production activation. Если требуется тест CLOSED branch — отдельная фаза. Privileged fixtures только CLOSED; при acceptance no fixture writer. Получить catalog evidence полного ACL/callgraph, regression денежные snapshots, absence bypass.

**C6 Activation:** controller под gate/fences checks manifest/test receipt/current DB identity/auth producer/adapters; single state transition CLOSED→ENFORCED. External fence снимается после commit; если они рассогласованы, функция всё равно fail closed. Пока production auth disabled реальных commands нет. Процедура для будущего production требует отдельного задания. При любом недоказанном C0–C5 admission CLOSED.

### Закрытие уже установленного протокола

closeAdmission берёт global gate и protocol conflicting UPDATE; существующая admitted transaction завершится до close commit. Новые команды после commit отказывают, SS старого snapshot abort. Затем connection fence и drain, чтобы никто не держал старые transactions/артефакты. Gate нельзя «отобрать» у живой transaction; срочное termination требует точной идентификации и отдельно утверждённых operational полномочий.

### Rollback без обхода

- До C3 commit: SQL rollback, external fence остаётся закрытым. Старые grants после rollback не считать безопасным разрешением записи; процесс не возобновлять.
- После schema commit: CLOSED + stop/drain; сохранить controls/generations/history/ACL. Forward-fix либо предыдущий совместимый guard-aware artifact. Не down/drop guard, не вернуть table DML старому runtime, не сбросить counters/approval binding.
- Partial deployment или failed acceptance: remain CLOSED, reason/audit; повторить deployment после анализа. Никаких reset volumes/восстановления main DB.
- Cutover close/open controller и installer credentials раздельны с runtime; действия аудируются. Если controller недоступен, не обходить gate админским UPDATE ради availability.

## 7. Исполнимая PostgreSQL test matrix (будущий harness)

Запуск только после отдельного разрешения идентичности test DB и role provisioning. Использовать ≥2 настоящие LOGIN connections A/B и observer O; real barriers `pg_blocking_pids`, явные BEGIN isolation и commit/rollback. Не owner→SET ROLE imitation как единственное доказательство. SQLSTATE проверять из driver, timeouts конечны, blocker test fixtures сохраняются. Здесь tests не выполнены.

Общий шаблон: fixture installer CLOSED -> baseline capture -> isolated runtime identity ENFORCED -> A.begin/approved command удерживает transaction -> B.begin/конкурентный вызов -> O подтверждает blocking -> release A -> assert B/result -> snapshot invariants. SS stale case: B сначала SELECT snapshot, затем A commits mutation, B вызывает guard. Retry driver считает attempts и чистые новые connections/transactions.

| ID | Исполнимые действия | Обязательный результат |
| --- | --- | --- |
| P01 | Runtime INSERT/UPDATE/DELETE/TRUNCATE/COPY FROM protected table | 42501, все суммы/controls unchanged |
| P02 | Runtime SET ROLE owner/installer; CREATE/ALTER/DROP/TRIGGER; role-admin | Denied; проверить транзитивные membership и PUBLIC |
| P03 | Call private helper/generic ledger/fixture function/overload | 42501 или отсутствие функции; no mutation |
| P04 | Подменить search_path/temp object/GUC/participant/контекст другого login | Не влияет на lookup/auth; deny; owner-private refs неизменны |
| P05 | A command удерживает gate; B revoke authority; обратный порядок | command-first commit перед revoke; revoke-first command deny; no stale cache admission |
| P06 | B SERIALIZABLE snapshot; A revoke COMMIT; B command | 40001 либо deny fresh retry; не success по old grant |
| P07 | A reserve; B evidence revoke; затем revoke-first | Full historical held coverage blocked либо new reserve deny; no release |
| P08 | Два runtime reserve одного lot/mandate до лимита | Только допустимое full cover; no oversubscription/partial residue |
| P09 | RC reserve vs SS no-apply lot probe; поменять порядок | Changed-row conflict/fresh predicates; no future apply реализация |
| P10 | Classification mutation vs reserve, reverse lot input/multiscope | Exact capacity/ranges; no order cycle; required generation changes |
| P11 | Candidate/decision concurrency/linked request legacy slot | Сохраняется cross-request invariant и independent participant |
| P12 | Внести чистый audit/no-op replay под approved reader | No semantic generation bump; current blocked reflected |
| P13 | Forced 40001/40P01 на statement и commit | ≤3 whole attempts; same key; no duplicate ledger/outbox |
| P14 | Auth/block/capacity/conflict и unknown commit | No blind retry; unknown -> exact reconciliation |
| P15 | Error after mutation/bump, deferred failure, outer rollback | Domain/control/auth/ledger/outbox atomic rollback |
| P16 | Receipt genesis/account contention/replay/revoke | One cash recognition/private genesis; blocked receipt replay refusal |
| P17 | Active transaction при close; queued RC/SS writer | Close waits admitted txn; subsequent writes deny/abort; external drain confirmed |
| P18 | Direct old-writer SQL при CLOSED; approved function при CLOSED | Both denied, отсутствие late-admission window |
| P19 | Fail migration before commit, deploy fail after commit | External fence либо DB CLOSED; rollback never grants legacy bypass |
| P20 | Missing guard/manifest mismatch/unknown effect/auth unavailable | Fail closed; no auto-create control/fallback |
| P21 | Fixture/background/login rights/catalog defaults | Fixture unavailable runtime; worker least privilege; no inherited bypass |
| P22 | Test all protected tables/functions ACL after replacement/new object | Exact allowlist, PUBLIC EXECUTE absent; no default privilege leak |

Future apply/reserve test использует test-only protected-state probe, НЕ работающий classification apply. Deadlock test искусственно через test harness locks, не включать unsafe lock inversion API в runtime. Реальные неожиданные deadlocks — дефект order, retries не оправдывают его. Изоляция review пока RC; SS tests относятся к guard probes/разрешённым coverage/authority paths.

Acceptance SQL read-only примеры для installer/observer:

```sql
SELECT session_user, current_user, current_database();
SELECT rolname, rolsuper, rolcreaterole, rolbypassrls FROM pg_roles;
SELECT * FROM pg_auth_members; -- плюс transitive effective membership audit
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('finance_api','finance_security');
SELECT pid,xact_start,state,wait_event_type,pg_blocking_pids(pid)
 FROM pg_stat_activity WHERE datname=current_database();
-- exact finance owners/ACL/defaults/function definitions/trigger callgraph/hash manifest
-- has_table_privilege(actual_login, exact_table, 'INSERT') = false и др.
```

## 8. План и оставшиеся deployment решения

Разрешённые владельцем архитектурные решения определены: отдельные owner/installer/runtime, local versioned auth, full closed cutover. Нового финансового правила для этого механизма не нужно.

До реализации/применения отдельно определить: (1) разрешённую test-role provisioning область — нынешний shared cluster либо отдельная permission-test DB без воздействия на соседние roles; (2) trusted producer и неforgeable login/context binding для production, пока disabled; (3) operational identities/полномочия close/drain/terminate/open и конечные timeout/backoff/deadline. Ни один неизвестный параметр не разрешает обход. MaxAttempts=3 уже утверждён и не открыт. Не назначены банк/тарифы/резервы.

Минимальный следующий этап: согласовать deployment scope и подготовить единый inactive пакет SQL API+guards+authority+все adapters+permission tests. Ни coverage-only, ни миграция-only cutover не допускаются. До доказательства полного manifest и acceptance — CLOSED, без AppModule, apply и реальных денег.

## 9. Контроль изменений

Создан только work/finance-6v5-9C-security-cutover-design.md. SHA-256 всех 57 baseline файлов finance-кода, тестов и трёх исходных спецификаций совпали. Main/finance DB, роли/grants, Docker/frontend/старые финансовые механизмы не затронуты. Commit/push/pull/fetch не выполнялись. Итог: main, HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9, staging пуст, status сохранил только известные ?? src/finance/ и ?? test/finance/. Whitespace check документа прошёл; предупреждение Git LF/CRLF не означает изменение index. Работа останавливается после отчёта.
