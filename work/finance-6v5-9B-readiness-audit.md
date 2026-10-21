# Cashback+ — 6В.5.9-Б: аудит готовности lot-version guard

Дата: 14.10.2026. **АУДИТ И ПЛАН; внедрение не начато.**

## 1. Вердикт и граница выполненной работы

**Готовность атомарного cutover пока не подтверждена.** Guard технически можно внедрить только как согласованный пакет schema + DB permissions/entrypoints + всех finance writers/readers + current authorization. Три выбора требуют решения до кодирования: отдельная PostgreSQL privilege boundary, доверенный источник актуальной авторизации и способ closed cutover.

Владелец потребовал сначала аудит и остановку при этих вопросах. Поэтому новые entities, migration-файлы, writer patches и DB-операции не создавались/не выполнялись. Подготовлены перечень изменений, модель permissions, migration/cutover/rollback план и проверяемые concurrency-сценарии. Нельзя считать их выполненными integration-тестами.

Изучены BUSINESS_SPEC_6B_FINAL, 9A, 8D, текущие finance services/entities/migrations и результаты 8-Г. Исторические 173 unit/53 PostgreSQL passes относятся к candidates/review, не к permissions или lot protocol. DB catalog/roles/config secrets/runtime environment в этом аудите не читались; фактические privileges не подтверждены.

Preflight: main, HEAD `1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9`; staging пуст; известные `?? src/finance/`, `?? test/finance/`. FinanceModule не подключён. Все production verifier/authority/mandate providers закрыты.

## 2. Найденные блокеры

| Факт по коду | Почему препятствует cutover | Необходимая подготовка |
| --- | --- | --- |
| Нет finance GRANT/REVOKE/role separation или защищённых command entrypoints | Обычный EntityManager raw DML не отделён от approved механизма | Dedicated runtime boundary, object ownership, закрытые SQL functions и все adapters |
| Все services используют прямые SELECT/FOR UPDATE/INSERT/UPDATE | Простое REVOKE сломает весь путь, включая ledger/receipt, а не только coverage | Заменить raw mutation paths утверждёнными DB commands; decision readers тоже внутри boundary |
| Authority interfaces описывают shared lock, но current grant/epoch storage отсутствует | Callback/token не доказывает согласованность с concurrent revoke | Trusted локальный grants/identity version store или эквивалентный доказуемый adapter |
| Нет lot control/state admission | Ни database-wide coverage freshness, ни old-client rejection не реализованы | Sidecar guard, protocol state, полный writer/trigger upgrade |
| AppDataSource/AppModule имеют fallback DB_USER=postgres | По config нельзя доказать restricted runtime; реальная env роль неизвестна | Finance-only DataSource с explicit identity, no privileged fallback; main config не менять |
| Test runner использует роль, способную выполнять finance migrations | Прежний success не проверяет ordinary-runtime SQL denial | Отдельные ограниченные test identities и negative permission suite |
| PostgreSQL CREATE ROLE не database-local | Новые роли в shared тестовом cluster требуют явного разрешения; права нельзя считать ограниченными DB name | Администратор/владелец выбирает approved test roles/cluster scope |

Не утверждается, что текущая env роль superuser: это не проверялось. Но reuse installer/owner role как runtime не может служить permission boundary. Менять production роли или основную БД запрещено.

## 3. Политика bump: уточнение прежнего проекта 9A

Новое решение владельца заменяет широкое правило «любая metadata/audit insertion повышает generation». Критерий — влияет ли mutation на финансовую допустимость, reserved amount, блокировку, назначение либо future correction admission. Unknown impact → **отказать до mutation**, не молча считать audit и не произвольно bump-ить всё.

| Mutation / путь | Привязка к решению и предлагаемый effect |
| --- | --- |
| New receipt/lot | Genesis control=1 в той же transaction; no historic financial backfill |
| Allocation/reservation state | Изменяет занятое покрытие → bump каждого affected lot |
| Original classified part INSERT | Меняет footprint/проверенное происхождение для назначения → bump |
| Evidence revoke/restore | Меняет допустимость всех связанных действий/bank version → bump mapped lot |
| Новое mapped verified evidence / действующий restoration-review prerequisite | Если меняет допустимые verification/restoration основания → bump; не просто за строку audit event |
| Exact candidate с independently verified content | Создаёт допустимый точный объект review/future approval; protected prerequisite, не access-log. Bump при его регистрации |
| Exact approve/reject | Меняет допустимость candidate и межзаявочный approval/intent slot → bump |
| Reason-only decision | Не apply approval, но текущий UNIQUE(requestId,operationVersion) закрывает exact-review slot. Нельзя объявить pure audit: effect admission → bump |
| New/linked request с verified identity/ancestry | Создаёт protected review scope и правила независимости; entry dependency → bump, не автоматически inherited approval |
| Header/result/archive, сопровождающий part/domain mutation | Не отдельный bump, если финансовое predicate меняет другая запись этой же команды |
| Observations без canonical lot mapping, quarantine без account-wide freeze | Нет associated lot decision change → no lot bump |
| State/history reads, exact replay, matching semantic no-op binding | No bump; старый token не разрешение дальнейшего использования |
| Access logs/notifications/failure telemetry | Pure audit → no bump; не участвует в predicates |
| Неизвестный новый тип mutation | Fail closed; impact mapper/тест сначала, no generic allow-any metadata |

Эта таблица следует current code dependencies: slot/ancestry/candidate identity используются проверками допуска. Если будущая модель уберёт dependency, mapper пересматривается отдельно. Не считать timestamp, audit attempts или число rows финансовым состоянием.

DB effect mapper должен иметь закрытый список typed commands/field changes. Материальный no-op не создаёт новый version. Exact replay возвращает исходные IDs/fingerprint и current blocked/stale. Lot generation не bank evidence version, не baseVersion, не денежный баланс и не отмена обязательства.

## 4. Точный перечень entrypoints для пакета внедрения

| Контур и методы | Необходимое изменение |
| --- | --- |
| BankReceiptsService.registerWithManager (new/replay) | Protected receipt command; genesis control/private-new-row exception; no duplicate ledger; replay prelocks current origin |
| EvidenceService.observeWithManager | Approved evidence intake, no lot bump без mapping; no account-wide quarantine block |
| approveWithManager | Current proof + observation-before-operation compatibility; mapped admissibility effect and guard |
| revokeWithManager, recheckWithManager, restoreWithManager | Associated lot/control prelock ДО mutation; verified basis/current rights; version/bump atomically |
| verifyWithManager, bindReceiptWithManager | Approved trust/binding validation; no arbitrary bank facts; semantic no-op not new lot event |
| inspectLotEvidenceWithManager, assertLotEvidenceWithManager | Protected decision read holding op/lot/control context до outer commit |
| historyWithManager | Scoped audit-only reader; no writable capability |
| CoverageService.createTargetWithManager | Approved synthetic mandate/target command; no allocation/cash; admission even if no lot effect yet |
| reserveWithManager | Precollect ALL origins/lots/controls до mandate/target; capacity+limit validated DB command |
| assertReservationUsableWithManager | Current guarded evidence/mandate reader, не spend/release right |
| ClassificationService.classifyWithManager | Approved range command/root+parts; full original constraints и effect bump |
| requestCorrectionWithManager delegate | Новое boundary для существующей подачи, no classify_source fallback |
| CorrectionsService.requestCorrectionWithManager, stateWithManager, reviewWithManager | Current participant/permission + ancestry/decision slot, guarded request/read/review |
| authorizeForCorrectionWithManager, lockRequestWithManager, assertIndependentWithManager | Внутренние helpers; нельзя получить grant/mutation только публичным helper вызовом |
| CandidatesService.createLinkedRequestWithManager, createCandidateWithManager, reviewCandidateWithManager | Exact proof/fingerprint, immutable lineage, cross-request UNIQUE и effect mapping |
| FinanceService.post/postWithManager, FinanceEventsService.postEventWithManager | Внутренний ledger primitive, не unrestricted runtime bank/account mutation. Receipt command вызывает ledger внутри approved DB boundary |
| Mutation/read SQL guards всех девяти finance migrations | Обновить вместе; AFTER/BEFORE/FK/deferred locks не обходят collector/admission |
| Integration seed/fixture/migration helpers | Только test/admin identity и package; ordinary runtime не EXECUTE и не импортирует |
| Future apply/release/reallocate/spend | Сейчас отсутствуют; closed admission до отдельной реализации/permission/test suite |

Дополнительный hidden writer считается blocker. Поиск raw SQL/method inventory повторяется при review package. Новый helper или новая grant function не получает исключение из матрицы.

## 5. Guard schema и единый lock order

Проектные структуры: finance_lot_control_versions(lotId PK/FK,generation bigint>0), finance_protocol_state(version,closed/enforced), trusted authorization grants/identity revisions и control epoch. Guard не хранит amount/free/blocked bool; финансовая истина остаётся existing immutable origin, allocations, ledger и current bank operation.

Один effect owner увеличивает generation в общей transaction, по реальному predicate change; service prelock-ит и не делает второй audit-only bump. Parent association immutable; missing guard/unknown protocol/unsupported isolation → denial. Overflow/reset/deletion guard запрещены. DB command и triggers проверяют typed effect, а не доверяют caller-supplied boolean affects_finance.

Порядок совместно со всем пакетом:

1. Protocol admission + shared auth `(726405,0)`.
2. Trusted grants/participant/authorization epoch rows.
3. Все scope locks 726404, затем все identity locks 726403, canonical actual key order.
4. Evidence approve observation phase (до op); все operation rows.
5. Все existing lot rows, затем все control rows.
6. Coverage mandate→target→reservation/allocations; либо receipt→request→candidate→decision/current base rows.
7. Для денежных receipt/будущих approved movement — event keys 726402 и sorted accounts.
8. Mutation/effect bump/deferred checks; caller commit.

Full collector собирает resources до ранних locks. Unknown mapping/resources → abort/replan. Не брать новый lot после mandate/accounts. Receipt genesis exception относится только к новым private receipt/lot/control UUID, недоступным другим sessions до commit; existing-lot lookup после ledger запрещён.

Mixed RC/SS: все relevant writers действительно UPDATE-ят guard; SS со старым snapshot abort/retry при changed row, fresh attempt заново принимает решение. No reliance on SS одной операции, advisory-only freshness или cached sum. Correction review остаётся RC-only; future SS probe/apply пользуется другим validator, не обходит этот guard.

## 6. PostgreSQL permission boundary — вариант для утверждения

Рекомендуется отдельный finance runtime identity/DataSource без main DB/installer credentials. Не переиспользовать AppDataSource fallback или тестовый миграционный login. Имена ролей ниже — проект, не уже созданные роли.

| Identity | Права / запреты |
| --- | --- |
| finance_owner (NOLOGIN) | Own finance objects/internal SQL helpers; runtime не member и не может SET ROLE |
| finance_runtime (отдельный ограниченный login) | CONNECT выбранной finance DB, USAGE approved API schema, EXECUTE конкретных commands/readers; no direct protected-table DML, no ownership/DDL/role administration/superuser/BYPASSRLS |
| trusted_authority_writer | Только отдельно утверждённое обслуживание проверенных grants/identity/epoch/proof registry, не банк/payments/lot bypass |
| finance_installer/admin | Offline schema/grant deployment и fixture provisioning; credentials не доступны runtime process/artifact |
| test fixture/probe identity | Изолированные synthetic tests; никогда runtime grants/production package |

**Защищённые таблицы:** accounts/journals/postings/outbox; bank receipts/funding lots/operations/observations/decisions/restore reviews/evidence events; coverage mandates/targets/reservations/allocations; classification roots/parts/requests/decisions/candidates; новые control/protocol/auth-state. Runtime не получает INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER или ownership. Чтение для финансового решения только через guarded commands; scoped audit readers не дают spend capability.

Mutation commands — узкие SECURITY DEFINER функции с фиксированным безопасным search_path, schema-qualified references, без arbitrary SQL/table-name parameters. PUBLIC EXECUTE снимается в той же transaction создания; EXECUTE выдаётся по точной signature/allowlist, internal bump/ledger/migration helpers runtime недоступны. Нельзя blanket GRANT EXECUTE ON ALL FUNCTIONS или просто сделать все старые trigger functions definer. Требования опираются на [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) и [Privileges](https://www.postgresql.org/docs/17/ddl-priv.html).

Функция выполняется в **уже открытой** caller transaction, не COMMIT. Она сама собирает locks, проверяет protocol/auth/evidence/domain predicates и записывает допустимый typed result. Functions нельзя оформлять STABLE/IMMUTABLE, если они lock/write. Вызов raw SELECT approved_function(...) допустим только как сам approved механизм, а не обход: body не принимает произвольный баланс/role/платёжную команду и повторно проверяет current state.

Runtime не EXECUTE generic post_any_accounts или arbitrary bank operation update. Внутренний ledger writer вызывается только approved receipt/domain function; unit/core integration могут проверять primitive через test-only identity, что не runtime privilege. Внешние post()/postWithManager() signatures можно сохранить как isolated internal primitive, но права production не расширять ради прежнего raw SQL. Этот переход требует согласования ledger adapter/compatibility tests.

GUC/transaction marker/переданный participantId не authentication. Требуется не подделываемый runtime-ролью trusted identity context и current DB grant/epoch validation. Definer повышает SQL privileges, но сам не доказывает банковский факт или полномочия пользователя. Default deny до настоящего authority/proof adapter.

### Почему это отдельное решение

Роли PostgreSQL имеют cluster scope, не ограничиваются одной test DB ([CREATE ROLE](https://www.postgresql.org/docs/17/sql-createrole.html)). Сейчас isolated finance DB находится в уже используемом test cluster; создавать новые роли даже с grants только на finance DB без отдельного разрешения нельзя считать только table migration.

Нужно выбрать: разрешённые dedicated test roles в нынешнем подтверждённом cluster либо отдельно разрешённая privilege-test среда; existing production/test/main роли не менять. Перенос ownership finance objects/права installer — также approval scope. Сегодня ни roles, ни grants, ни ownership не менялись.

## 7. Authorization freshness — выбор до реализации

Сейчас interfaces обещают shared lock, но DB storage/epoch/доверенный producer отсутствуют. Модель tests с JavaScript maps не доказывает production revocation guarantee.

Рекомендуемый вариант для isolated подготовки: отдельно утверждённый local DB authorization/identity store с synthetic verifier, namespace/contexts только тестовые. Production provider остаётся отключённым.

Контракт будущего настоящего adapter:

- Verified responsible participant identity и current scoped action grants поступают от доверенного producer; caller runtime не может записать/подделать их.
- Revoke/change grant/identity/proof validity и epoch UPDATE — одна transaction под тем же authorization gate.
- Command берёт gate+epoch, затем читает current permission/verified identity и proof references внутри защищённой transaction. Старый токен только selector/caller authentication, не доказательство продолжающихся полномочий.
- SS после concurrent authority update получает epoch changed-row conflict; fresh attempt отказывает отозванному grant. Пока epoch lock держится, revoke ждёт и commit order однозначен.
- Нет доказуемого producer/revocation protocol/identity binding → отказ. Нельзя заменить его периодическим cache refresh, JWT expiration или произвольным UUID.

Production trust gateway/local identity источник и permissions authority-writer должен выбрать владелец. Вариант external authorization не запрещён, но нужен доказанный transaction-compatible freshness contract; до него fail-closed, не синхронный network lookup под bank locks.

## 8. Retry contract — утверждённый лимит закрыт

**Не более 3 попыток всего, первая включена.** Нельзя задавать больше через caller/config. Retry только precise PostgreSQL 40001 или 40P01, definite aborted transaction, guaranteed same-key/material idempotence и отсутствие внешних side effects до commit.

Полный rollback/release → новая transaction/snapshot → fresh authorization/evidence/capacity/base → same immutable command. Вложенный post()/partial savepoint retry не заменяет это. Deadlock retry не отменяет анализа нарушения lock order.

Не retry auth denial, evidence blocked, insufficient cover, stale/business material conflict. 23505 не blindly transient: можно отдельно read-only reconcile exact prior result; это не повтор mutation. Unknown commit/result → reconciliation сначала, без автоматической четвёртой попытки/нового key. После третьего definite transient abort вернуть failure, не success.

Backoff/deadline ещё не имеют чисел; они должны быть finite/конфигурируемы безопасным способом, без user override maxAttempts. Retry exhaustion/attempt telemetry pure audit, no generation bump.

## 9. План файлов, миграции и атомарного cutover

**Предлагаемые будущие файлы, не созданные сейчас:** lot-control/protocol-state entities, LotProtocolService/resource collector, approved command DB adapter, finance-specific DataSource/token, retry helper, local authority interface/store adapter; finance schema migration + permissions deployment script; guarded runtime/concurrency/negative privilege test runner.

Изменить совместно все paths §4: raw EntityManager financial decision queries/writes → approved command/readers; helpers/providers — current transactional context; SQL mutation/effect guards; integration fixture paths — separate privileged role. CoverageService и ledger/receipt adapter нужны в одном пакете, не staggered updates.

Роль/credential provisioning — отдельный согласованный administrative шаг, не auto migration основного приложения. После него schema transaction должна:

1. Подтвердить exact isolated DB/role attributes/ownership/schema/history; если unknown main/production target → stop.
2. Под полной finance quiescence взять global gate ДО DDL. Отдельный finance admission closed; default-deny retained.
3. Создать controls generation=1 для existing lots и genesis hook новых; это технический baseline, не financial/approval backfill. Сохранить все balances/candidates/history.
4. Создать current-authority hooks, narrow SQL functions/effect mapping и grants/ownership boundary совместно. Protected-table raw runtime DML закрыто в той же transaction. Unknown impact path запрещён.
5. Проверить one-to-one controls, all functions/entrypoints/roles/default privileges; COMMIT closed schema. Не выдавать runtime bypass для «прохождения tests».
6. Deploy только новый inactive finance artifact без admin/fixture/migration credentials/export entrypoints. Старые workers/test invocations остановлены; старые binaries при запуске не имеют raw DML, функция/admission version checks fail closed.
7. Разрешённый isolated test principal проходит весь suite по тому же механизму; fixture writes отдельно fenced, не доступны ordinary runtime. До успеха admission для runtime closed.
8. Один final activation переключает closed→enforced только при complete schema/code/privileges/auth acceptance. Это атомарность **доступа к доменным операциям**, не обещание общей transaction файловой deployment и SQL. В промежутке writes закрыты; не период смешанных активных writers.

FinanceModule остаётся вне AppModule. Production activation, main DB roles, реальные operations — отдельное задание, не результат этого cutover. Если невозможно доказать quiescence/owner separation/absence old bypass, не выполнять шаги 3–8.

Rollback: до schema commit PostgreSQL откатывает весь пакет; после commit admission закрывается, invocations останавливаются, данные/controls сохраняются, forward-fix. Нельзя downgrade только services на old raw writers или выполнить destructive migration down, reset generations, restore/delete volumes/backups.

## 10. Проверки concurrency и permissions — план, не результаты

Для будущего разрешённого isolated PostgreSQL suite: ≥2 реальные connections + observer pg_blocking_pids; barriers и snapshot-before-wait, не одни unit/Promise.all. Проверять ordinary runtime login, не owner/superuser impersonation через SET ROLE с сохранёнными privileges.

| ID | Сценарий | Ожидание |
| --- | --- | --- |
| R01 | Два coverage reservations, один lot/общий mandate | Точные capacity/limit bounds; full atomic cover |
| R02 | RC reserve → SS test-only no-apply guard probe со старым snapshot | 40001/re-evaluate, fresh hold виден |
| R03 | SS probe-first → waiting reserve | Commit ordering, no duplicate cover; probe не production apply |
| R04 | Revoke-first/reserve-first, restore | Block/current version или preserved blocked history; no release |
| R05 | Classification metadata/range change vs reservation | Согласованные guards/effect, no stale assignment |
| R06 | Current auth revoke simultaneously with command, RC/SS | Gate/epoch current denial, old token недостаточен |
| R07 | Forced 40001 and 40P01 statement/commit | ≤3 whole attempts, fresh checks, stable keys |
| R08 | Business auth/evidence/capacity/material denial | Ровно одна попытка, no automatic retry |
| R09 | Unknown commit и stable-key reconciliation | No blind resend/no false success |
| R10 | Outer rollback after effect bump/deferred failure | Domain/control откатились вместе |
| R11 | Pure audit/no-op/read/replay | Generation unchanged; new approved/rejected admission effect отдельно проверен |
| R12 | Raw INSERT/UPDATE/DELETE/TRUNCATE/COPY into protected tables | Ordinary runtime permission denied, no state change |
| R13 | SET ROLE owner, inherited grants, schema/function shadowing, forged GUC | Boundary denies/escalation невозможна |
| R14 | Call internal bump/generic ledger/fixture/migration functions | Runtime not EXECUTE; approved function validates all predicates |
| R15 | Missing control/unknown effect/protocol mismatch/old writer | Fail closed; no mixed active window |
| R16 | Multi-lot/scopes reverse input/hash collisions/target-before-lot | Canonical ordering; no newly introduced cycle |
| R17 | Receipt genesis/replay under account contention | One cash recognition/lot/control; private genesis exception |
| R18 | Existing candidate/ancestry/exact approval and reason-only slot regressions | NULL bindings/history/uniqueness preserved; effect mapper intentional |
| R19 | Counter overflow/reused QueryRunner/unsupported isolation | Denial/rollback, stale context rejected |
| R20 | Partial migration/artifact failure during closed cutover | Admission stays closed, controls/history not discarded |
| R21 | Auth/proof producer unavailable/identity missing | Default deny, no synthetic production fallback |
| R22 | Monetary snapshots before/after guard-only metadata phase | Exact accounts/ledger/outbox/allocations invariance |

Explicit acceptance audit: catalog role flags/memberships/object owners/grants/default privileges, PUBLIC access, every executable function, every raw query path, artifact contents and identity-constrained DS. Privileged bypass tests document threat boundary, not a claim to prevent DBA actions.

Разрешения на исполнение тестов этого нового механизма и migration deployment ещё нет: текущий этап завершается аудитом. Не заявляется, что raw SQL boundary или mixed isolation уже проверены.

## 11. Решения владельца и готовность следующего шага

| Нужно подтвердить | Рекомендация |
| --- | --- |
| DB roles/boundary и test cluster scope | Dedicated finance runtime + NOLOGIN owner + installer separation, narrow SECURITY DEFINER commands; отдельное разрешение provisioning только test scope |
| Авторизация/revocation producer | DB-local synthetic authority store для isolated подготовки; production остаётся deny до настоящего trusted adapter |
| Cutover | Offline closed/enforced пакет, без active old/new writer overlap, с deny raw DML и coordinated adapter updates |

Scope generation теперь основан на effects, не чистом audit; лимит retries=3 принят и **больше не открыт**. Точные finite delay/deadline параметры не назначены. Реализация разрешается лишь после выбранной privilege/auth/cutover модели и доказательства полноты package.

Бизнес-правила B66/GBP/splits/долги/reserves/порог выплат не меняются. Нет нужды выбирать банк или размер финансового резерва для этого технического audit.

## 12. Контроль состояния

Создан только `work/finance-6v5-9B-readiness-audit.md`. Source/writers/migrations/tests/существующие specifications, main DB, Docker/frontend/bonus_transfers не изменены. No roles/grants/config/credentials changes. Build/unit/integration/migration/DB commands не запускались. Прочитана официальная PostgreSQL documentation; никаких bank API calls.

Git commit/push/pull/fetch не выполнялись; FinanceModule не подключён; доходы/начисления/own-free/payments не создавались. Финальная SHA-256 сверка всех 232 baseline files подтвердила отсутствие изменений. Ветка main, HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9; staging пуст; git status --short сохранил только ранее существующие ?? src/finance/ и ?? test/finance/. Проверки whitespace не выявили ошибок (Git сообщил лишь предупреждение о возможной будущей конверсии LF/CRLF документа). Работа останавливается до решения владельца.
