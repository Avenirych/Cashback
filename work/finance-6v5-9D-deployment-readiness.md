# Cashback+ — 6В.5.9-Г: deployment readiness

14.10.2026. READ-ONLY AUDIT + DESIGN. Вердикт: deployment **не готов**. Создан только этот отчёт; роли/БД/Docker/code не изменены. Проектирование выполнено, реализация остановлена до устранения инфраструктурных и identity-блокеров.

## 1. Источники, наблюдения и предел доказательств

Изучены 9A, 9B, 9C, compose.yaml, redacted структура docker/compose.test.env и compose.env.example, docker/backend/Dockerfile, AppModule/data-source, TopicsService, finance services/authority interfaces, test/finance/README и runners. Секреты не выводились. Никакие DB credentials не использовались для соединения.

| Установлено по файлам | Значение для deployment |
| --- | --- |
| compose project cashback-docker-test; postgres-test postgres:17-bookworm | Общая тестовая среда, не отдельный finance инстанс |
| PostgreSQL DB cashback_docker_test, пользователь cashback_test; postgres-test-data | Изолированная finance DB на этом сервере не изолирует cluster roles |
| Finance runner: cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77, OID 24780, cluster 7695793866029359141, IP 172.18.0.2 | Историческая точная identity; сегодняшняя live identity НЕ подтверждена |
| Runner использует postgres-test:5432/cashback_test и process.env.DB_PASSWORD | Finance tests и application test используют одно имя DB identity; фактические ACL не проверены |
| Compose backend передаёт DB_PASSWORD и DATABASE_URL из одного test secret; JWT_SECRET отдельно | Разделения installer/runtime/authority/operator credentials не видно |
| AppModule/CLI DB_*; fallback user postgres/DB cashback | Не использовать для нового restricted finance runtime; фактическая env роль неизвестна |
| TopicsService создаёт отдельный pg.Pool из DATABASE_URL | TypeORM manager не единственный SQL connection path; inventory всех pools обязателен |
| synchronize=false, migrationsRun=false; finance не импортирован AppModule | Нет установленного автозапуска finance; не является DB permission boundary |
| Finance services raw EntityManager SQL; migrations/triggers и test fixtures raw SQL | Все пути требуют coordinated conversion/fencing; существующие tests не least-privilege acceptance |
| ConfigModule/dotenv, environment-based secrets, backend test executor | Secret provisioning/revocation и separation не реализованы как deployment protocol |

Compose database network internal=true, PostgreSQL host port не опубликован в этой конфигурации. Backend имеет application+database networks; это network isolation от внешней сети, не изоляция ролей/финансовых данных от backend. PostgreSQL bootstrap POSTGRES_USER не считать restricted runtime; фактические role flags/catalog неизвестны. Не утверждается, что текущий пользователь superuser, credentials утекли или все контейнеры сейчас работают.

Read-only попытка `docker ps -a` не выполнилась: docker отсутствует в PATH; стандартный C:\Program Files\Docker\Docker\resources\bin\docker.exe тоже отсутствует. Никаких Docker mutations/exec/SQL не выполнено. Отдельный изолированный finance instance по доступным файлам не найден; его отсутствие во всей машине не доказано. Live catalog, mounts, sessions, OS scheduled tasks, внешние deployment agents и production инфраструктура не обследованы. В .github/workflows файлов не обнаружено этой проверкой; это не доказательство отсутствия внешнего CI.

Поиск Cron/Interval/ScheduleModule/setInterval/BullModule/OnModuleInit в backend src не нашёл объявленного scheduler. Finance outbox worker/delivery не реализован. Это только static finding: внешние jobs/manual scripts нельзя исключить. Legacy ORM writes и BonusService SQL не подключать к finance и не изменять; доступ общей identity потенциально может обходить будущую границу, если ACL оставлены широкими.

Preflight main, HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9; известные ?? src/finance/, ?? test/finance/, staging пуст.

## 2. Изолированная permission-test среда

Последнее решение владельца заменяет открытые варианты 9B/9C: **никакого role provisioning в общем cluster**. Отдельная database в postgres-test также НЕ подходит.

Минимальный предлагаемый вариант: отдельно разрешённый новый PostgreSQL 17 instance с отдельным PGDATA/новым volume, отдельной private network и test runner, без подключения existing application containers/networks/volumes. Не использовать postgres-test-data, main/finance historical DB или старые credentials. Роль bootstrap/admin только installer executor; runtime/issuer/operator logins отдельно. Можно использовать самостоятельный локальный PostgreSQL instance вместо Docker, если он уже установлен и доступен; проверка identity обязательна.

Создание нового instance/network/volume/DB/ролей требует следующего явного разрешения. Сейчас ни один объект не создавался. Не назначены порт, имена volumes/пароли; они выбираются после inventory конфликтов. Никакой очистки прежней среды.

При будущем preflight read-only зафиксировать cluster system_identifier (отличается от 7695793866029359141), точные endpoint/DB OID, version, process/container ID, PGDATA/mount identity, network attachments, bootstrap/runtime role flags, owners и migrations. Одного database prefix или другого порта недостаточно. Если совпадает PGDATA/cluster с существующим — STOP. Старые runners имеют fixed identity/history и не могут быть запущены на новой среде без отдельной адаптации и согласованного baseline. Новые synthetic fixtures не переносить из application DB.

## 3. Модель ролей и оператор

| Identity/роль | Полномочия | Не получает |
| --- | --- | --- |
| finance_object_owner NOLOGIN | Владение protected objects | Runtime login/membership |
| finance_installer | Offline schema/permissions под CLOSED | Credential в application artifact; обычный business execution |
| finance_runtime group + authenticated LOGIN identities | Узкие approved financial commands, current authority checks | Table DML/DDL, owner membership, open admission |
| finance_authority_writer | Узкие trusted identity/grant/revoke APIs | Ledger DML, финансовые права или self-grant |
| finance_cutover_operator | close/status и запрос controlled reopen | Денежный DML/finance command grants, изменение grants/identity, installer membership |
| finance_permission_auditor | Scoped catalog/manifest/acceptance inspection | Owner privilege и денежная запись |
| finance_cutover_approver | Подтвердить проверенную readiness для конкретного manifest | Самостоятельные денежные операции/изменение таблиц |
| finance_fixture | Synthetic provisioning в CLOSED изолированном instance | Production runtime availability |

Разделение operator/approver — рекомендуемый технический контроль, ещё не утверждённая персональная кадровая политика. Если владелец выбирает одного уполномоченного оператора, DB функция reopen всё равно проверяет независимые machine acceptance evidence и полный manifest; runtime никогда не open/close. Кто именно занимает роли — отдельное решение.

Operator закрывает admission через narrow SECURITY DEFINER close function; она не позволяет произвольный SQL/table update и не может менять money. Installer устанавливает migrations/ACL при external fence+CLOSED. Auditor проверяет privileges реальным runtime LOGIN и catalog/callgraph. Reopen выполняется отдельной функцией по operator request и trusted acceptance/approval record, bound DB identity+schema/code manifest+authority version, не по переданному boolean testsPassed. Нельзя runtime передавать fake operator role или receipt acceptance. Owner/installer/DBA остаются privileged trusted boundary; ограничения не защищают от сознательного DBA вмешательства.

NOINHERIT не заменяет проверку membership/SET ROLE; исключить транзитивные owner/installer/admin memberships. Exact EXECUTE allowlists, safe search_path, schema-qualified references, revoke PUBLIC/default privileges, no generic ledger function. Отдельные credentials для каждого executor, не DB_* общий fallback. Секреты не в repo/логе/payload; rotate/provision только отдельным разрешённым действием. Background worker получает свою минимальную identity; сейчас worker не создаётся.

## 4. Trusted authorization: доказуемый вариант и альтернативы

Текущие authority callbacks и synthetic JavaScript maps не позволяют PostgreSQL доказать principal/participant/rights/transaction binding. Ни JWT, ни GUC, ни UUID input этого не исправляют. **Production default deny остаётся обязательным; реализация невозможна безопасно с нынешней shared-login моделью без нового trusted boundary.**

### A. Рекомендуемый минимальный доказуемый isolated prototype: authenticated DB identity

1. Отдельная настоящая PostgreSQL LOGIN identity для каждого тестового principal, без membership позволяющей SET ROLE другого principal. DB authentication устанавливает session_user. Finance runtime group предоставляет только approved functions.
2. Owner-private DB store сопоставляет session_user с principalId и verified participantId. Mapping создаётся только trusted authority writer; alias logins одного участника дают одинаковый participantId. Payload identity игнорируется/конфликт -> deny. current_user definer не caller: owner-функция использует session_user.
3. Узкая DB функция в текущей transaction после global gate и admission/auth fences получает server-generated full transaction ID, backend PID, database OID и собственный contextId. Создаёт private transaction context с principal/participant/grant versions/auth epoch/protocol version. Caller не INSERT/UPDATE/SELECT эти rows и не задаёт их поля. Context применяется только при совпадении текущих server transaction ID/PID/DB/login; после commit/rollback не пригоден. PID без full transaction ID недостаточен. Subtransaction/savepoint не считается независимой transaction; rollback context делает его недоступным.
4. Каждая protected command заново под fences читает current active identity/grants/scope и trusted mandate/proof. Context — привязка, не cached permission. Между API calls outer transaction holds gate; downgrade/identity revoke тоже требует этот gate. Expiry проверяется server time, не client timestamp. После завершения результат только historical.
5. DB отличает подделку по authenticated session_user + private-store ownership/ACL + server-generated transaction tuple, не секретной session variable. Copy contextId в другое соединение/transaction или SET ROLE не меняет session_user и не проходит binding. При database/login mismatch/default auth disabled/missing verified identity отказ.

SQL-псевдокод, НЕ реализация:

```sql
-- Только owner-private helpers; caller не передаёт actor/participant/epoch.
PERFORM pg_catalog.pg_advisory_xact_lock(726405,0);
PERFORM finance_security.check_and_touch_admission();
PERFORM finance_security.touch_authority_fence();
identity := finance_security.lookup_verified_login(session_user);
PERFORM finance_security.assert_current_grant(identity, action, scope);
ctx := finance_security.make_private_context(
  identity, pg_catalog.pg_current_xact_id(), pg_catalog.pg_backend_pid(),
  finance_security.current_database_oid());
-- Любой последующий command проверяет tuple и current versions заново.
```

Этот вариант доказывает DB principal, но не автоматически human identity за shared application service. Компрометация principal credential означает компрометацию этого principal; MFA/secret custody/authenticated responsible participant provisioning должны быть отдельно проверены. Масштабирование per-user DB logins/pool не утверждается для коммерческого сайта. Service principal действует только за закреплённого ответственного participant в допустимом scope, не выбирает arbitrary beneficiary/инициатора из payload.

### B. Shared application pool: доверенный transaction gateway/issuer

Если нужны многочисленные human principals за общим app login, требуется отдельный изолированный trusted gateway, а не доверие к обычному backend. Gateway проверяет аутентификацию и DB current grants; обычный runtime не получает gateway credential/signing capability. DB выдаёт challenge, привязанный к transaction tuple, exact command fingerprint/audience/login/nonce. Trusted issuer подтверждает verified principal/participant и challenge; DB проверяет криптографическое доказательство и current store, затем помечает применение атомарно. Proof нельзя использовать с другим payload/transaction/retry. Retry -> новая transaction/challenge, прежний immutable business key. Не хранить raw банковские данные в attestation.

Проверка подписи должна выполняться доступным проверенным механизмом на стороне DB/gateway boundary; текущий проект не содержит такого механизма и наличие crypto extension не проверено. Нельзя подменить его UUID/hash/обычным caller-supplied session context. Вариант gateway, единолично владеющего защищённой DB transaction и отдельной trusted LOGIN, тоже требует доказуемого authenticated subject-to-transaction binding; shared gateway session_user сам по себе доказывает gateway, не человека.

Ключевой недостаток B: issuer compromise, transport/channel binding, replay registry, key rotation и отсутствие remote I/O под финансовыми locks. Challenge validation/issuer обмен выполнить до lock-critical mutation; после обмена внутри transaction все current grants/version predicates повторяются. Если невозможно безопасно организовать snapshot/transaction binding без длительного external I/O, не активировать B. Не утверждать доступность банка/IdP/extension без проверки.

Рекомендация: A в новом isolated instance для permission/freshness acceptance; production B либо иной формально проверенный gateway выбирается отдельным проектом. Не переносить synthetic identity/verifier в production. Клиентские JWT могут быть input аутентификации gateway, но не доказательством актуальных grants; кэш не authority truth.

## 5. Конкурентный отзыв и lock order

Единый order 9C сохраняется: global (726405,0) -> admission conflicting row UPDATE -> authority conflicting row UPDATE/current identity/grants -> все scope keys 726404 -> все identity keys 726403 -> approve-only sorted observations -> sorted canonical operations -> все lots -> все controls -> branch rows -> ledger keys/accounts. Actual advisory key dedup/order обязателен. Ни actor/service callbacks, ни SQL fixture path не обходят gate.

Revoke authority получает gate и те же fences, меняет grants/identity/context validity и epoch в одной transaction с audit. Линейная точка — revoke COMMIT. Command-first допускается commit прежде ожидающего revoke; revoke-first command deny. Это не retroactive rollback допущенной операции. Если внешний IdP отозвал право, а DB ещё не получила trusted revoke, freshness относительно IdP НЕ доказана: production admission denied до согласованного protocol доставки/linearization.

Mixed isolation: advisory lock не refresh SS snapshot. Conflicting UPDATE admission/auth/lot fence необходим даже для guarded decision read. RC видит committed revoke после ожидания; stale SS abort 40001 и fresh retry. Semantic lot generation меняется только по effect policy, MVCC fence no-op не semantic bump. Pure audit не bump. Unsupported isolation fail closed. Current correction/candidate RC contract не менять данным этапом; future apply лишь design/probe.

Максимум 3 whole attempts включая первую, только definite 40001/40P01 с immutable key и отсутствие внешнего effect. Unknown outcome reconciliation, auth/evidence/capacity/material conflict без retry. Контекст не переживает retry; новый server tuple/fresh checks. Runtime raw SQL не может touch fences/helpers благодаря ACL. Отзыв evidence не освобождает coverage/обязательства и не сторнирует cash.

## 6. Cutover и восстановление

1. Operator external-fences все finance callers/worker/CLI и запрашивает CLOSED. До установки DB admission нужен infrastructure fence; не полагаться на несуществующий gate. Общий app credential нельзя остановить выборочно без риска основной БД: для prototype использовать отдельный instance/executors.
2. Auditor идентифицирует active/idle/prepared transactions exact environment. Wait drain; cancel/terminate только заранее утверждёнными полномочиями и exact sessions. Никакого автоматического kill соседних процессов.
3. Installer одним закрытым schema/ACL пакетом ставит guards, private contexts/store, safe functions и all writer adapters, production authority disabled. Нет периода writer с прежним DML. Новые Genesis и historical guard baseline не меняют money.
4. Auditor real-runtime connections проверяет permissions/mixed isolation/revocation/cutover negatives; fixture executor выключен до проверки. Acceptance evidence создаёт доверенный test/deployment producer, не runtime boolean.
5. Operator/approver проверяют exact DB/artifact/protocol manifest и результаты; controlled reopen function под gate фиксирует решение. Runtime не member operator/approver и не EXECUTE reopen. В prototype разрешены только synthetic principals. Production real activation отдельным заданием.

При failed migration до commit: SQL rollback, external fence сохраняется, не возобновлять legacy writer даже если ACL откатились. После commit/deploy failure: CLOSED+drain, сохранить controls/ACL/history; forward-fix либо guard-compatible artifact. Никогда не возвращать direct DML, не down/drop/reset guard, не менять volumes. Если reopen уже состоялся и найден defect, operator close linearizes после завершения admitted transactions; затем safe drain/reconciliation. Audit outage/unknown acceptance -> CLOSED.

## 7. Необходимые изменения и контрольные проверки

Будущий единый inactive пакет: новый isolated instance config; explicit runtime/installer/authority/operator/observer DS; private login mapping/current grants/contexts; DB API и guards; coordinated receipt/evidence/coverage/classification/candidate/decision SQL conversion; exact role ACL manifest; новый isolated runner. Старые согласованные documents/src сегодня не изменяются.

Приёмка должна включать real multi-connection tests: forged principal/participant/epoch/GUC; copied context across PID/transaction; stale JWT/current grant revoke; same-participant alternate login; issuer unavailable; direct DML/SET ROLE/private function attack; mixed RC/SS; evidence revoke/reserve; two reservations; old writer while CLOSED; active transaction/drain; failed migration rollback; runtime cannot reopen; fake acceptance receipt; max3 retries/unknown commit; money/history unchanged. Проверить background/fixture credentials absent runtime artifact. Полная матрица 9C сохраняется, не считается выполненной.

## 8. Решения перед реализацией и следующий этап

| Решение | Рекомендация/последствие |
| --- | --- |
| Разрешить создание отдельного instance + new storage/network/test DB | Минимальный PostgreSQL17 prototype; existing shared cluster untouched. Сейчас только предложение |
| Identity binding для isolated tests | A: реальные DB LOGIN principals + private server-generated transaction context; production disabled |
| Production shared pool binding | B/другой проверенный trusted gateway отдельно; без выбора и доказательства production deny |
| Назначить operational operator/installer/auditor/reopen approver | Раздельные полномочия; выбрать персональные ответственные identities и emergency drain authority |
| Finite cutover/retry deadlines и issuer lifecycle | Отдельные operational параметры; max3 не меняется; никаких произвольных денежных тарифов/резервов |

Минимальный безопасный следующий этап — отдельно разрешённое создание isolated security-test instance и prototype A/roles/negative tests, без подключения AppModule и реальных финансовых операций. После доказательства ACL/auth freshness готовить coordinated full cutover package. Нынешняя shared cluster finance DB не target для новых roles. Архитектура production пока не обеспечивает требуемую привязку; автоматический переход к реализации остановлен.

## 9. Итоговый контроль

Создан только этот документ. Код/миграции/данные/roles/grants/Docker/config/credentials не изменены; основной и finance PostgreSQL не подключались. Docker inventory не выполнился из-за отсутствия CLI. SHA-256 всех 235 baseline файлов совпали. Итог: main, HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9, staging пуст, status сохранил известные ?? src/finance/ и ?? test/finance/. Whitespace check прошёл; предупреждение LF/CRLF не изменило index. Нет commit/push/pull/fetch, classification apply, доходов/начислений/выплат. После отчёта — остановка.
