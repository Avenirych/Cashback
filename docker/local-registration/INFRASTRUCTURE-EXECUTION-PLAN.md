# Единый план инфраструктурного допуска регистрации Cashback

**BLOCKED. Документ подготовлен; инфраструктурное выполнение не разрешено.**
Актуальная source-only creation integration описана в первом разделе существующего
`FIRST-START-RUNBOOK.md`: отдельные signed authorize-creation/attest-creation,
durable reservation/result в прежнем ledger, First-Start/Post-Start composition,
protected production credential loaders и helper artifacts. Старые записи ниже
об отсутствии этих source-контрактов относятся к прежнему состоянию. Реальные
credentials/PKI, images, fencing actuator и approvals по-прежнему не provisioned;
helper task transport реализован для фиксированной диагностики; без реальных
runtime credentials/admission/external actuator задания BLOCKED. Применение
миграций по-прежнему только через прежний Harness и закрытые gates.
Source-only контракты существующих компонентов обновлены. SQL, подключения к БД,
Docker, секреты и реальные approvals не выполнялись. Gates остаются закрытыми.
Затронутые тесты повторяются, поскольку изменён соответствующий код.
Шаги ниже последовательны: отсутствие предусловия означает STOP до следующего шага.
Это условный runbook, а не команда выполнить всё без последующих разрешений.

## 1. Точная граница цели

Во всех SQL-шагах **T** означает одновременно ВСЕ следующие значения:

| Параметр | Ожидается |
| --- | --- |
| Context / daemon | desktop-linux / ec3d6303-4d66-4410-8317-b739cebc046c |
| Project | cashback-registration-20261016-4f8c2a96b17d |
| Container | cashback-registration-20261016-4f8c2a96b17d-postgres-test-1 |
| Полный ID | e0818fd64b0149f50ed975d8a519ffc4b615dcff9544a403f224fd82a2291d88 |
| Cluster system identifier | 7697703338450784294 |
| Database / OID | cashback_docker_test / 16384 |
| PostgreSQL / owner | 17.11 (170011) / registration_bootstrap |
| Image | postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df |
| Platform | linux/amd64 |
| Volume | cashback-registration-20261016-4f8c2a96b17d-pg17-data |
| Network | cashback-registration-20261016-4f8c2a96b17d-database, internal |
| Host port | Не публиковать |

Expected values не доказывают текущее состояние. Перед каждым будущим изменением —
свежая Docker-проверка, затем read-only SQL идентичности в той же целевой сессии.
Любое несовпадение, пересоздание контейнера/кластера или OID drift — STOP и новое
согласование, не автоматическая замена expected values/policy.

**Исключены из всех операций:** cashback-docker-test-postgres-test-1,
cashback-finance-security-9f-pg-1, их базы/volumes/networks и прочие старые ресурсы.
Глобальные роли меняются только в подтверждённом НОВОМ кластере. Никаких FDW/dblink,
общего DATABASE_URL, Docker down/prune/recreate или использования старых БД как ledger.

## 2. Найденные блокеры исходников — прежде любых инфраструктурных записей

Проверены существующие access-sources/adapters/controller, approved-evidence,
concurrency, registration-target, migration datasource/preflight/runner, readiness/probe,
Compose/admission и документация. Секретные файлы не читались.

| Блокер | Конкретный контракт | Необходимое предварительное согласование P0 |
| --- | --- | --- |
| Порядок ролей исправлен | baseline/phone используют registration_migrator; runtime требует cashback_test | Migration executor без elevated flags/memberships, runtime отсутствует до завершения 7; exact security hash и DB owner сохраняются. Реальное создание требует P3-W/P7. Legacy random DB без изменений. |
| Gate закрыт | runner: PHONE_APPLY_CONCURRENCY_VERIFIED=false; concurrency: ATOMIC_EXCLUSION_NOT_IMPLEMENTED | Сейчас не менять. После реальных испытаний нужен отдельный P0-G source-review проверенного enforcement; credentials не открывают gates. |
| Fencing отсутствует | ProductionConnectionControlAdapter.assertReady() | EXCLUSIVITY_NOT_ENFORCED. Подключить реальную актуацию к существующему administrative interface, без нового контроллера/runner. |
| Observer/session authority нет | createProductionMigrationSources передаёт null credentials/directory | Защищённые credential source, независимое enrollment и session directory. |
| Trust anchors нет | Signed fingerprint/receipt adapters получают null | Независимые approval ledgers, issuers и отдельно утверждённые public pins; не auto-approve измерения. |
| Phase-scoped topology реализована | validateRegistrationPeers в target factory и Docker adapter | Exact IDs, pinned images + actual image ID/platform, config fingerprint, labels, network ID/IP, no ports. Unknown peers BLOCKED; backend только runtime с opaque schema/role proof. Реальные peers требуют P2 и отдельного admission review. |
| Admission разрешает только PG | local-registration/admission.ts фиксирует template hash, services=[postgres-test], profiles=[] | Новая служебная фаза только в существующем admission, после отдельного review; не обновлять hash ради PASS и не использовать ручной docker run в обход. |
| Target proof зависит от bootstrap/exec | collectRegistrationPhoneTarget использует bootstrap password и psql через docker exec | Реализован observer acquisition через exact approved observer peer с read-only psql; bootstrap default сохранён. Observer image должен содержать psql17, credential/route ещё не provisioned. Не выдавать bootstrap приложению. |
| Enrollment реализован source-only | ApprovedSessionDirectory и existing observer/protocol/controller | Подписанные session/executor/phase/review/target/security/epoch, challenge/nonce и expiry. Directory issuer и credentials отсутствуют; требуется P1. |
| Session-bound receipts реализованы | Existing signed adapter и Access Controller | Входные operation permissions Harness не являются независимыми receipts. После actual session enrollment проверяются подписанные B+C/BASELINE с phase/executor/security/epoch. Production enrollment issuer/composition отсутствуют. |
| Fence-through-COMMIT реализован как контракт | PhoneFencedTransaction в existing concurrency module и existing runner | Внешняя durable reservation, проверки каждой mutation query и COMMIT ACK/outcome; closed gate не меняется. Реальные ledger/enforcement и длительная parent boundary отсутствуют. |

Source-only противоречия ролей, topology, enrollment/receipts устранены. Безопасной
команды миграций ещё нет: реальные authorities/ledger отсутствуют, gate false и
APPLY_ELIGIBLE закрыт. Инфраструктурные фазы условны до provisioning и real trials.

## 2а. Реализованные контракты и recovery

1. `RegistrationTargetApproval.phase` = baseline/phone/runtime. Историческая операция
   без phase означает только phone. Phase входит в opaque target и review hash;
   перенос phone proof в baseline/runtime отвергается. Registration migration datasource
   запрещает runtime target. Legacy random-name Harness по-прежнему требует cashback_test.
2. `registration_bootstrap` остаётся administrative principal/DB owner. Отдельный
   `registration_migrator` выполняет baseline и 7: NOSUPERUSER/NOCREATEROLE/NOCREATEDB/
   NOREPLICATION/NOBYPASSRLS, без memberships. CREATE/ownership объектов фиксированных
   миграций и диагностические EXECUTE разрешаются только отдельным approved ACL diff.
   Runtime cashback_test отсутствует до 7 и создаётся после confirmed COMMIT; runtime
   без неё BLOCKED. Runtime не получает ownership таблиц. Full security hash не ослаблен.
3. `RegistrationNetworkApproval` копируется в adapter; transport добавляет только
   exact inspect ID/image paths утверждённых peers. Public default whitelist прежний.
   Все peer identities измеряются, network inventory перечитывается до возврата.
   `inspectRegistrationRuntime` выдаёт private token <=5 s только в активной read-only
   транзакции с exact T, restricted runtime role, историей 1–7 и reviewed schema/security
   fingerprints. Caller JSON ready=true не является доказательством. Ни один peer сейчас
   не утверждён, Docker networks не изменяются; P2/admission review остаются обязательными.
4. `ApprovedSessionDirectory` расширяет existing signed reader, не вводит новый controller.
   Signed envelope purpose=enrollment, lookup reviewSha256=session hash; отдельный
   migrationReviewSha256=hash фиксированного набора миграций/review. Payload содержит
   enrollmentId (256-bit), full target, PID/backend_start/xact_start, phase/executor,
   security fingerprint, fencing epoch, observedAt/expiresAt. Ed25519 pin, audience,
   challenge/nonce и TTL <=5 s обязательны. Issuer независим от runner и подтверждает
   actual session перед выдачей. Реальных anchors, credentials и enrollment не создано.
5. Observer/Protocol/Access Controller сверяют enrollment с actual session, phase, review,
   role, target/security и epoch. Directory invalidation передаётся observer. Изменение
   состояния/source loss отзывает leases; reconnect/новая транзакция требует нового enrollment.
6. B+C/BASELINE проверяются existing signed receipts adapter/controller: подпись/pin,
   challenge/nonce/expiry, точные permissions, operation/session/review/enrollment/phase/
   executor/security/epoch. Один approval ID относится к одному lease, recheck этого lease
   не расходует receipt повторно. Локальный replay set не заменяет межпроцессный ledger:
   независимый issuer обязан durable резервировать IDs и отзывать их по state/epoch drift.
   Issuer/ledger не развёрнуты, production factory оставляет null inputs.
7. `PhoneFencedTransaction` — lifecycle в existing concurrency module. Не authority,
   controller или migration runner. `DurableMigrationOutcome.reserve` атомарно записывает
   COMMIT_PENDING до mutation и отказывает при unresolved attempt по T + migration review,
   даже для нового session/PID/epoch. Ошибка reserve закрывает instance. Fencing binding/epoch
   проверяются против independent protocol lease. Closed apply gate всё ещё запрещает работу.
8. Dormant mutation path existing runner проверяет external fence до/после каждой query
   внутри migration.up(), включая history writes. Перед COMMIT query wrapper снимается,
   lifecycle проверяет сам COMMIT, ACK и durable outcome. Durable record обязан атомарно
   проверять epoch и удерживать administrative boundary до подтверждения записи. Короткий
   observation lease, advisory lock и локальный mutex не заменяют continuous parent fencing.
9. Потеря fence до COMMIT: FENCING_LOST_BEFORE_COMMIT, STOP; только confirmed rollback
   позволяет durable ABORTED_BEFORE_COMMIT. Ошибка rollback/record оставляет pending.
   Потеря fence во время COMMIT, ошибка ACK/record: COMMIT_OUTCOME_UNKNOWN. Нет reset/retry/down,
   повторного apply или rollback как доказательства исхода. Release соединения не разрешает retry.
10. Reconciliation требует отдельного read-only разрешения на exact T: полная история,
    каталог/ACL/ownership, actual session/backend status. Противоречие/живой mutator — STOP.
    Разрешить новый review и изменить durable outcome может только independent authority
    после отдельно утверждённого reconciliation; writer/reset в lifecycle отсутствует.
    При process loss/restart/expiry pending не очищается, boundary не открывается автоматически.

Исходники authority, durable journal и mTLS транспорта теперь подготовлены (раздел 13).
Реальные prerequisites остаются: P1 provisioning credentials/keys/directory/issuers/journal;
P2 exact peers/routes после admission review; P3 роли/ACL; P4 исключение admin entrypoints
(включая Docker exec/local socket/superuser); P5 real concurrency trials; затем P0-G.
`ProductionConnectionControlAdapter` без независимо закреплённого external fencing reader
возвращает EXCLUSIVITY_NOT_ENFORCED. Default factory не получает такой reader.
PHONE_APPLY_CONCURRENCY_VERIFIED=false и APPLY_ELIGIBLE закрыты. Миграции 1–7 не менялись.

## 3. Пять источников и необходимые runtime inputs

| Источник | Что provision отдельно | Проверка / отказ |
| --- | --- | --- |
| DockerMetadataTransport | Отдельный control-plane principal с read-only whitelist к exact desktop-linux daemon | Реальные full IDs/labels/image/platform/volume/network/health/no ports. Raw Docker socket нельзя передать клиенту даже с mount :ro. |
| PostgreSQL observer | Новый registration_observer credential через ObserverCredentialSource, защищённый маршрут к T, TrustedSessionDirectory | Exact cluster/OID/version/owner/peer, readonly settings, schema/history/security и фактический enrolled backend. Нет источников — OBSERVER_AUTHORITY_MISSING. |
| Approved fingerprints | Отдельный Ed25519 issuer/keyId/publicKeyPem/HTTPS endpoint, audience cashback-registration-migration, purpose=fingerprints | Подпись canonical envelope v1/revision 1, identity/review/challenge/nonce/expiry. Эталон не выводится автоматически из T. |
| B/C receipts | Отдельный issuer/key/purpose=receipts и approval ledger владельца | Seventh требует B+C, baseline — BASELINE; target/session/operation/before/after hashes. JSON/env/CLI не approval. |
| AdministrativeExclusion | Независимые access actuation, durable fencing ledger, session-bound lease и loss notifications | Без реального ограничения подключений всегда EXCLUSIVITY_NOT_ENFORCED. pg_stat_activity и advisory lock не достаточны. |

Дополнительно нужны отдельные credentials administrative actuator, будущего migrator,
observer, app-role и service authentication directory/control-plane. Private signing
keys остаются только у независимых issuers. Не копировать admin/app/JWT secrets из
registration.env; не менять существующие .env/owner policy. Новые credentials, service
ACL и public trust anchors — P1, вне repo/build context/logs, отдельные principals.

Directory хранит epoch, full target, operation/review, PID/backend_start/xact_start,
peer и receipt binding. Enrollment идёт из реального pg_stat_activity независимым
источником, с точным форматом строк существующего OBSERVER_SESSION_SQL. Hash tuple
не подтверждает происхождение сам по себе. Reconnect/новая транзакция требует нового
enrollment и session-bound C, а не переноса старого receipt.

## 4. Topology и административные пути

Предложенная будущая topology: один maintenance peer для существующего Harness и
один независимый observer peer в registration database-сети, без host-портов.
До создания отдельно утвердить immutable images, полные IDs, service/project labels,
mounts и network allowlist через существующий admission после P0. Неопределённые
deployment inputs — STOP, а не разрешение выбрать произвольный контейнер.

Docker observer остаётся на control-plane host с desktop-linux. SQL observer в
приватной сети использует аутентифицированный fixed-whitelist metadata transport;
raw Docker API внутрь не выдаётся. HTTPS authorities/directory требуют отдельного
утверждённого канала: internal сеть сама не даёт egress. Не отключать internal и не
добавлять default network незаметно. Broker transport существующего datasource
согласуется явно, не маскируется DNS-подменой postgres-test. SQL target остаётся T:5432.

До maintenance независимо инвентаризировать mutator paths НОВОГО кластера:
- registration_bootstrap (superuser/DB owner), владельцев schemas/tables/types/sequences;
- будущего registration_migrator, CREATE DATABASE/schema, PUBLIC/default ACL;
- CREATEROLE, ADMIN OPTION, наследование и SET ROLE пути;
- активные privileged sessions во всех DB этого нового кластера, replication,
  prepared transactions, background/extension/scheduled actors;
- Docker/Windows/WSL/SSH/socket/API administrators и interactive SQL clients.

Неожиданный путь — STOP, не автоматический REVOKE/kill. Каждый путь либо закрыт,
либо входит в явно контролируемый administrative actuator с ограниченным scope.
HBA reload не прекращает существующие сессии; их закрывают и проверяют отдельно.

## 5. Observer: точная последовательность минимальных прав (проект, не SQL-выполнение)

Только T после свежей идентификации, под separately authorized actuator:
1. Убедиться, что registration_observer отсутствует. Если существует — STOP/review,
   не IF NOT EXISTS, перезапись password или присвоение старой роли.
2. В одной role-setup транзакции создать NOLOGIN registration_observer,
   NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS; задать
   default_transaction_read_only=on, statement_timeout=1000ms, lock_timeout=500ms,
   idle_in_transaction_session_timeout=2000ms.
3. CONNECT только на T, USAGE public. Проверить inherited/PUBLIC/default privileges.
   CREATE/TEMP/непредусмотренный CONNECT у PUBLIC убирать только по approved ACL diff T,
   не общими revoke по другим базам.
4. В T выдать EXECUTE pg_catalog.pg_control_system(); SELECT(subdbid) на
   pg_catalog.pg_subscription и SELECT(oid) на pg_catalog.pg_largeobject_metadata
   для существующих count-запросов. Проверить достаточность под observer; не выдавать
   SELECT subconninfo или полный доступ к секретным системным каталогам.
5. Для metadata чужой enrolled-сессии — только pg_read_all_stats membership:
   ADMIN=false, INHERIT=true, SET=false. Не pg_monitor/pg_read_all_data/pg_signal_backend.
   Текущий adapter отвергает elevated attributes и другие административные memberships.
   Отказ чтения каталога — STOP, не повышение до bootstrap/superuser.
6. Не давать SELECT users/marketing/bonus, ALL TABLES или blanket default table grants.
   public.migrations ещё нет: точечный SELECT на неё только после baseline. Таблицу
   вручную ради grant не создавать.
7. Сравнить фактические ownership/memberships/effective ACL с approved diff и COMMIT.
   Ошибка внутри транзакции — rollback; неизвестный COMMIT — отдельное read-only
   расследование до любого повторения setup.
8. По P1 provision новый независимый observer secret в credential service; password
   устанавливается защищённым каналом без SQL logging/CLI output. LOGIN включить
   только после HBA boundary. Ничего не сохранять в Git или существующие env-файлы.
9. Разрешённым read-only probe подтвердить target/role/readonly/catalog access.
   Негативные DDL/ACL пробы — только отдельный P5 и заранее допущенные test objects.

Частичный role setup не означает право DROP ROLE. Оставить закрытый LOGIN/ingress по
approved recovery scope, не переиспользовать секрет, расследовать отдельно.

## 6. Реализуемый межпроцессный fencing и восстановление

Развёртывание существующего Access Controller получает administrative provider:
защищённый service principal, закрытый credential store и durable write-ahead epoch
ledger вне T/репозитория. Не использовать старые PostgreSQL, SQLite или finance как
хранилище. Один authority service держит единственный writer handle, с durable fsync
и журналом восстановления. Несколько authority writers запрещены; для нескольких
hosts понадобится отдельно согласованный consensus ledger.

Локальный lock сериализует только ledger. Он НЕ доказательство SQL-эксклюзивности.
Реальное fencing обеспечивают серверная boundary и controlled connection broker:

1. В journal durable записать RESERVING(epoch+1) с exact T, operation/scope, principal,
   session tuple, leaseId/expiry, approved source hashes и commit outcome.
2. Применить отдельно разрешённый HBA/NOLOGIN/credential diff только нового кластера.
   Разрешить T только observer/broker/actuator с точных утверждённых peers. Учесть
   local Unix socket, другие DB и replication: не оставить обход trust/peer/admin login.
3. Reload конфигурации без пересоздания PG-контейнера. Положительные и отрицательные
   подключения должны подтвердить действующие правила, а не только файл на диске.
4. Под отдельным разрешением закрыть существующие неразрешённые backends нового
   кластера; проверить prepared work/прочие mutators. Нет termination proof — STOP.
5. Bootstrap credential доступен только administrative actuator. Прямой interactive
   bootstrap login закрыт. Сам actuator — явно контролируемый privileged путь, без
   общего SQL API во время migration scope. Observer не получает terminate/DDL права.
6. Broker хранит migrator credential и выдаёт одному утверждённому экземпляру
   существующего Harness контролируемое соединение. Сырой повторно используемый
   пароль и прямой обходной маршрут runner не получает. Pending enrollment допускает
   только аудированную подготовительную часть Harness, не arbitrary SQL API.
7. Независимо подтвердить реальный backend/session и boundary; только затем durable
   ACTIVE(epoch). Другой runner не получает writable stream/backend независимо от
   advisory lock. Фактическая broker/TypeORM интеграция сейчас отсутствует: это P0/P4.

При expiry/потере процесса, authority/observer, ledger или scope:
- прекратить выдачу новых команд и закрыть stream; доставить REVOKED в существующий
  concurrency-протокол; независимый watchdog действует при потере heartbeat;
- actuator завершает exact enrolled backend и проверяет его исчезновение/завершение
  транзакции. Обрыв TCP не считать доказательством отмены SQL/COMMIT;
- **новый epoch не становится ACTIVE, пока старый backend способен выполнять команды**;
  если actuator недоступен — RECOVERY_REQUIRED, никаких новых writers/leases;
- после restart сначала прочитать durable journal и сверить старые sessions/outcomes.
  Epoch не обнулять; старые tokens не восстанавливать из JSON. Повреждённый ledger
  запрещает новое лидерство до отдельно утверждённого recovery;
- неизвестный COMMIT — read-only проверка schema/history, без automatic retry/down.

Это обеспечивает последовательность admissions при сбое: даже если незавершённую
команду нельзя мгновенно остановить, второй writer не допускается до reconciliation.
Гарантию немедленной отмены уже исполняющегося SQL при полной потере управления не
заявлять. Host/Docker administrators остаются trusted assumption: абсолютной защиты
от владельца хоста нет; нарушение maintenance commitment отзывает scope.

Parent maintenance lease обязан покрывать operation -> COMMIT -> подтверждение
результата. Child proof текущего кода одноразовый и <=4s; его нельзя молча продлевать.
Для реального применения нужен отдельно проверенный bounded parent lifecycle с
live command/commit interlock либо доказанный срок всей операции с fencing по
дедлайну. Одного start-time check недостаточно. Сейчас этот код не реализован,
поэтому APPLY_ELIGIBLE остаётся недоступен. По окончании durable CLOSED только после
подтверждения outcome/закрытия mutation sessions; никаких автоматических broad grants.

## 7. Независимые эталоны и receipts

Measurer снимает metadata; другой reviewer сверяет их с неизменёнными migrations,
точной версией и role/ACL stage; owner утверждает; отдельный issuer подписывает
только approved ledger entry. Private signing key не принадлежит Harness/контроллеру.
Подпись на controller measurement не заменяет независимого решения.

Ожидаемые after-hashes готовятся воспроизводимым независимым анализом и при
необходимости отдельно разрешённой reference-проверкой. Не мигрировать T без эталона
с последующим «утверждением» результата задним числом. Reference-кластер не создаётся
автоматически: нужен P5-R, без старых/финансовых ресурсов. Hash оттуда нельзя переносить
без сравнения PostgreSQL version, roles/owners/ACL и канонического формата. Jest fixture
не является independently approved fingerprint.

Ниже обозначения review stages, НЕ выданные fingerprints/receipts:

| Stage | Содержимое и назначение |
| --- | --- |
| F0 | Пустая T после observer/migrator/ACL setup; PHONE_EMPTY_SCHEMA_V1 и полный security hash |
| F6a | Ожидаемый результат 1–6, ownership мигратора, шесть history rows, до observer SELECT grant; PHONE_SCHEMA_V2; это BASELINE.afterSixSha256 |
| F6b | F6a после точечного SELECT public.migrations observer; новый relacl/schema/security hash; это seventh before/B/C stage |
| F7a | Ожидаемая 7 с E.164/SMS checks и неизменёнными user rows, до runtime-role/ownership transition |
| F7b | После создания cashback_test, ownership transfer/revokes/runtime grants; новый независимо reviewed readiness hash/policy |

Observer не может прочитать public.migrations после baseline до точечного grant.
Baseline commit/F6a сначала подтверждается контролируемым owner/Harness и отдельно
разрешённым read-only административным probe; затем grant, независимый F6b. Не
выдавать SELECT ALL TABLES ради устранения этой зависимости и не скрывать ACL drift.

BASELINE разрешает только 1–6. B/C относятся к seventh-only: полный target, реальная
сессия/transaction, operation, inventory/schema format, before/after hashes, security
stage и срок. Смена сессии/transaction/ACL/epoch требует нового enrollment/решения;
старый B не превращается автоматически в C новой apply-сессии.

Существующий отдельный B preflight заканчивается rollback, поэтому его transaction
tuple не является tuple последующего apply. Перед actual apply authority должен
независимо подтвердить новый snapshot и заново выдать session-bound B/C для apply
backend/transaction, сохранив связь с reviewed preflight artifact. Не переписывать
старый receipt. До решения этой двухфазной интеграции P0 шаги 9–10 запрещены.

Для каждого freshness-запроса issuer проверяет действительность approved artifact и
подписывает свежий challenge-bound envelope: purpose/audience/issuer/keyId/review,
identity/payload/nonce/challenge/expiry. Это не повторное разрешение миграции.
TTL <=5s, original child lease <=4s и не renew при inspect. Не уложились в 750ms
controller/1s protocol deadlines — STOP и отдельный timing/source review, не
подстановка timestamp/отключение проверки. Каждый approved ACL change отзывает старые
proofs и переводит stage, даже когда само изменение разрешено.

## 8. Последовательность реальных шагов и последствия частичного выполнения

Во всех строках target T означает ВСЕ параметры раздела 1. Вне-БД подготовка также
имеет только T в scope. Все permissions перечислены в разделе 11; сейчас не выданы.

| Шаг / permission | Предусловия | Допустимое будущее изменение | Проверка результата | STOP / частичное выполнение |
| --- | --- | --- | --- | --- |
| 0 / P0 | Локальные source contracts; нет DB/Docker операций | Согласованные registration-scoped role/topology/broker/session изменения существующих компонентов из раздела 2 | Review scope, новые тесты только изменённого кода; legacy, readiness и закрытый gate сохранены | Пока хоть один listed blocker не решён, никаких шагов 1+; gate этим пакетом не открывается |
| 1 / P1 | Отдельные principals, exact T, approved ACL/trust requirements | Provision credential service, independent issuers/pins, session directory и durable ledger вне repo | Разделение private keys/credentials, protected provenance, negative signature/replay checks | Нет authority/защиты ledger — BLOCKED; частичные secrets не печатать/не переиспользовать/не удалять без разрешения |
| 2 / P2 | Fresh Docker identity T, approved exact topology и admission | Только заранее перечисленные NEW maintenance/observer peers/routes/metadata bridge | Exact IDs/images/labels/network allowlist; PG container ID и volume не изменены, host port отсутствует; старые resources совпадают с snapshot | Неизвестный ID/digest/маршрут — ничего не создавать. Ошибка — no automatic retry/down/cleanup |
| 3 / P3-RO | Только T, отдельное разрешение read-only SQL | Снять identity, schemas/tables/history, roles/ACL/memberships, sessions/prepared work | Новая пустая база; cashback_test ещё отсутствует; никаких неожиданных объектов/privileged paths | Неожиданные tables/history/roles — STOP; не удалять и не подгонять эталоны |
| 4 / P3-W | T после шага 3, reviewed exact grants и P0 role separation | Observer setup раздела 5; registration_migrator LOGIN под credential control; registration_schema_owner NOLOGIN; migrator только CONNECT/USAGE/CREATE public и узкие identity/catalog-read права | Нет elevated attributes/memberships; DB owner bootstrap; application tables не создавались; будущими объектами владеет только migrator | Ошибка в транзакции — rollback; COMMIT неизвестен — read-only investigation; cashback_test пока НЕ создавать |
| 5 / P4 | T, approved recovery channel/ACL/HBA diff, приложения выключены | Ingress/HBA/NOLOGIN controls, reload, закрытие только разрешённых backends НОВОГО кластера, broker/fencing | Independent positive/negative logins, zero uncontrolled paths, durable epoch/enrollment | Не доказана boundary — нет ACTIVE. Частичный HBA/NOLOGIN остаётся fail-closed; не восстанавливать общий доступ автоматически |
| 6 / P5 | T, пустая схема, explicit synthetic objects/roles и recovery scope | Конкурентные испытания раздела 9 без application migrations | Boundary/expiry/fencing действуют, после trial independently verified F0 | Неизвестный outcome/невосстановленная пустота — STOP. Cleanup только заранее перечисленных synthetic objects после проверки состояния |
| 7 / P0-G + P6-A | Реальные trials PASS, reviewed F0/F6a, BASELINE receipt, exact operation permit | Отдельно рассмотренное gate/atomic-use source изменение; затем только SAME runPhoneBaselineBootstrap: 1–6 в одной транзакции | Внутри exact history/schema; известный COMMIT и отдельное read-only F6a подтверждение | Текущие false/atomic gates не обходить. Known rollback требует fresh F0 review; unknown commit — no replay |
| 8 / P3-W-6 | T, подтверждённый F6a/commit, maintenance boundary | Только SELECT public.migrations observer | Observer видит шесть history rows; independently approved F6b учитывает grant; старые proofs revoked | B/C по F6a запрещены. Ошибка grant — read-only ACL review, не повтор baseline |
| 9 / P6-B | T/F6b, reviewed F7a, новая enrolled apply-сессия/transaction | Existing Harness B preflight read-only; затем независимое session-bound C решение owner | Exact 1–6/history/schema/security/identity, live parent epoch, authentic B/C | Новый PID/xact_start/ACL/epoch — новое enrollment/receipts; preflight не разрешает apply |
| 10 / P6-C | T/F6b, current B+C, enforced parent lease, reviewed F7a, gates открыты только отдельно | SAME runPhoneMigration('apply',...): только AddUserPhoneAndSmsConsent1792195200000, locks/checks и одна history insert | Семь exact history rows, F7a, корректные CHECKs, no user DML, known COMMIT; independent post-commit read до release fence | Error/expiry/loss — revoke/stop. Не automatic down/retry; неизвестный COMMIT расследовать |
| 11 / P7 | T/F7a/known commit; cashback_test отсутствует; приложения выключены | Только теперь runtime-role creation, exact ownership transfer и grants/revokes раздела 10 | No runtime memberships/ownership/CREATE/TEMP/elevated flags; независимо reviewed F7b | Частичный transfer/grant не runtime-ready; backend закрыт; observer фиксирует промежуточный stage |
| 12 / P8-RO | T/F7b и независимо reviewed privileges/provenance | Итоговый read-only контроль; release maintenance ingress только по approved diff | Mutation sessions закончены, epoch durable CLOSED; no stale proofs; приложения не запускались | Нельзя вернуть широкие PUBLIC/admin grants для удобства; readiness без будущего SMTP остаётся fail-closed |

Migration functions остаются существующими, generic TypeORM CLI и synchronize запрещены.
После P0 точная trusted composition/invocation этих функций должна быть частью review;
сейчас безопасной единой команды реального исполнения нет. Этот план не маскирует это
командой, которая заранее упрётся в gate или обойдёт его.

Baseline строго:
1. InitialApplicationTables1733927999000
2. AddMarketingPreferences1733928000000
3. AddEmailVerification1735000000000
4. AddForumUsers1791394800000
5. CreateBonusTables1791630000000
6. AddUsersEmailUnique1791888000000

Затем только AddUserPhoneAndSmsConsent1792195200000. Application tables вручную не
создавать. Историческая migration 5 затрагивает только T; finance resources/services
и финансовый код не меняются.

## 9. Будущие реальные конкурентные испытания — только T

Каждый trial требует P5: exact target, approved synthetic names/roles/ACL diff,
независимый audit и разрешённое восстановление. Приложения выключены. Сначала
проверять отказы без фактических изменений; успешные synthetic writes только если
они отдельно перечислены в test scope. Испытания application migrations не заменяют
разрешения P6. Нельзя переносить их на старые/финансовые базы.

| Trial | Ожидаемый отказ / блокировка | PASS и безопасное восстановление |
| --- | --- | --- |
| Второй DDL/owner client, включая change-then-revert | Не получает writable backend, либо scope revoked/fenced до нового admission | Audit enforcement + оба client outcomes; unchanged final hash один недостаточен. Approved synthetic rollback и fresh F0/F6b |
| GRANT/REVOKE/default ACL/ownership | Controlled administrative path не позволяет неучтённую запись; fingerprint drift отзывает admission | Отказ или REVOKED; проверить effective/PUBLIC/default ACL, восстановить только approved diff |
| CREATE/ALTER ROLE, memberships/ADMIN/SET ROLE, другой DB нового кластера | Boundary охватывает cluster-wide привилегии, не только schema public | Нет uncontrolled privileged path; revoke/fence. Не подключаться к старым кластерам |
| Второй процесс того же Harness | Только один global epoch/backend; loser не получает credential/stream | Нет overlapping ACTIVE epochs/дублированной history; local mutex/Map не считаются достаточным PASS |
| Drift между B и C, другой PID/xact_start | Старый proof/receipt отвергнут, seventh up не начинается | Fresh enrollment/independent review; synthetic rollback только в approved recovery scope |
| Потеря observer/admin/issuer, network partition, expiry | Stop forwarding/new admission, revoke; backend terminated либо RECOVERY_REQUIRED без нового writer | Не подтверждено termination — FAIL/STOP, не «TTL истёк, значит безопасно»; старый epoch не оживает |
| Kill runner после lease, во время DDL и около COMMIT | Нельзя унаследовать session/token; независимый watcher/actuator удерживает boundary | Read-only schema/history/commit investigation; no automatic rerun/down/cleanup |
| Kill authority/watchdog, journal/fsync fault/restart | Fail-closed, epoch не сбрасывается, сначала reconciliation | Durable audit согласован; старый epoch fenced. Повреждение ledger — отдельный recovery review |
| Подмена container/volume/network/SQL peer | Exact identity mismatch до mutation | STOP, сохранить evidence; expected IDs не обновлять автоматически |

После trial доказать восстановление пустого/утверждённого stage. Неожиданный объект,
неизвестный COMMIT или необходимость неразрешённого удаления — STOP. Проба rollback
не доказывает отсутствие уже принятого COMMIT. Успешные mock-тесты не заменяют trials.

## 10. Создание runtime cashback_test строго после 7

Этот порядок поддерживается реализованным phase-scoped role contract. Не создавать cashback_test заранее ради
hardcoded literals и не давать ей временные DDL/superuser права.

После известного COMMIT/F7a, при закрытых приложениях:
1. Создать NOLOGIN cashback_test с NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
   NOBYPASSRLS, без memberships/ownership. Credential provision только по P1/P7.
2. Перенести exact reviewed application tables, sequences и enum types мигратора
   на registration_schema_owner NOLOGIN. Не использовать REASSIGN OWNED без точного
   roster: это может затронуть лишнее. DB owner остаётся registration_bootstrap.
   Public schema owner и все grants включить в независимый fingerprint.
3. Точечные grants runtime, соответствующие existing readiness allowlist:
   - database CONNECT; schema public USAGE;
   - users и marketing_preferences: SELECT/INSERT/UPDATE;
   - users_id_seq и marketing_preferences_id_seq: USAGE;
   - migrations: SELECT;
   - узкий EXECUTE pg_catalog.pg_control_system() для существующего identity probe.
4. Никаких CREATE/TEMP, DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, sequence UPDATE,
   blanket default grants, memberships в owner/observer/admin ролях или ownership.
   Проверить PUBLIC/default ACL и column/routine privileges: readiness сравнивает
   effective exact allowlist, а не только явные grants.
5. Закрыть LOGIN/credential route/CREATE мигратора, подтвердить отсутствие его сессий.
   Не DROP автоматически; остаточное владение — STOP и exact ownership review.
6. Получить независимо approved F7b/RegistrationPolicy provenance; включать runtime
   LOGIN только в отдельно разрешённом будущем app-access scope. Backend не запускать.

Любой частичный ownership/grant transition оставляет приложение заблокированным,
а старые F7a proofs недействительными. Без реального будущего SMTP этапа readiness
обязан оставаться 503; Mailpit guard не ослаблять и ready=true не имитировать.

## 11. Конкретные разрешения, которые потребуются отдельно

Каждый пакет ссылается на full T, этап, exact ACL/resource diff и recovery scope.
Инфраструктурные разрешения этим source-only заданием не выданы. P0 source-контракты реализованы в объёме раздела 2а; runtime wiring требует отдельного review.

| Permission | Точный объём |
| --- | --- |
| P0 | Source-only review/реализация существующих registration-scoped role, topology, broker, target-proof и двухфазного session/receipt контрактов. Сохраняет legacy/readiness; gate пока false. Никаких новых контроллеров/runner. |
| P1 | Новые независимые credentials/services/keys/public pins/directory/ledger, защищённые service ACL вне Git. Текущие secrets/.env/policy не менять без явного отдельного разрешения. |
| P2 | Только перечисленные новые maintenance/observer peers, защищённые routes/metadata bridge после admission review. Без PG replacement/host port и без старых ресурсов. Пока inputs не утверждены, создание запрещено. |
| P3-RO | Read-only SQL только T: identity, роли/ACL/sessions/catalog/history и подготовленность к setup. |
| P3-W | Exact observer/migrator/NOLOGIN schema owner creation и минимальный ACL diff, только новый кластер; без application tables и без раннего cashback_test. |
| P4 | Изменения HBA/config/ingress только нового volume/кластера, reload без container replacement, termination только заранее разрешённых backends, broker/fencing actuation и recovery channel. |
| P5 | Конкретные real concurrency trials и synthetic objects/roles вместе с ограниченным rollback/recovery. |
| P5-R | При необходимости отдельный reference experiment для независимых эталонов; не переиспользовать T без нужных approvals или старые/финансовые ресурсы. |
| P0-G | Отдельный source-review реальных enforcement/trial доказательств и controlled admission-to-use lifecycle. Только после этого рассматривать изменение false/atomic-exclusion gates; этот документ их не переключает. |
| P6-A | Baseline 1–6 через existing Harness, independently reviewed F0/F6a и реальный BASELINE receipt. |
| P3-W-6 | Только post-baseline SELECT public.migrations observer и review F6b. |
| P6-B | Read-only seventh preflight; независимое новое B/C решение для actual apply session. |
| P6-C | Только seventh apply через existing Harness с actual B+C, reviewed F6b/F7a и enforced parent epoch. |
| P7 | Только после 7: runtime-role creation, exact ownership/grant/revoke transition и review F7b; не запуск приложений. |
| P8-RO | Итоговый read-only контроль и release maintenance routes только по отдельно утверждённому diff. Без восстановления широких PUBLIC/admin прав. |

## 12. Итог и STOP

Порядок: P0 -> independent inputs/topology -> read-only T inventory -> observer/migrator
setup -> real boundary/fencing -> concurrency trials -> independent approval/source
gate review -> baseline 1–6 -> observer history grant/F6b -> current B/C -> 7 -> только
затем cashback_test/runtime grants/F7b -> итоговый read-only контроль.

Role/topology/session/receipt/fence source-контракты реализованы. Не завершены
production composition, независимый enrollment producer, bootstrap-proof transport после
закрытия bootstrap, реальные parent enforcement/ledger и trial доказательства.
Без P1–P5 отсутствуют независимые authority и реальные ограничения доступа. Эти
препятствия нельзя исправить передачей credentials или снятием флага.

Никаких неподтверждённых IP/digests/issuer endpoints/keys/peer IDs здесь не выдумано.
Незаполненные infrastructure inputs — обязательные STOP-условия до утверждения;
executor не вправе выбирать произвольный ресурс и считать план уже одобренным.

Проверки source-only этапа: затронутые Jest suites, backend TypeScript no-emit,
типы fixtures и git diff --check. Docker/SQL не выполнялись; secrets, policy, admission,
миграции, finance и commit/push не затрагивались.

**STOP. Это один план будущего выполнения, а не разрешение на инфраструктурные действия.**

## 13. Source-only исполняемые инфраструктурные артефакты

Статус: **подготовлено к отдельно разрешённому provisioning, execution BLOCKED**.
Новые файлы не являются параллельным admission/controller/runner. Authority создаёт
именно существующий `cashback-registration-approval/v1` envelope; existing readers,
Access Controller, Harness и gates сохраняются. Реальные Docker/SQL/keys не выполнялись.

| Артефакт | Реализация и граница |
| --- | --- |
| `src/docker-phone-infrastructure-ledger.ts` | Append-only JSONL, hash chain + exact T, sequence, exclusive wx writer lock, fsync. Durable epoch/enrollment/nonce/approvals/receipt consumption/revocation/key state/pending COMMIT/reconciliation. Не SQLite и не целевой PostgreSQL. |
| `src/docker-phone-infrastructure-authority.ts` | Раздельные fingerprint/receipt/enrollment issuer instances. Независимый Ed25519 owner-review key подписывает exact payload hash/action/target/challenge/expiry; issuer key никогда не self-approves. Нет генерации ключей на import и нет auto-review live measurements. |
| `src/docker-phone-infrastructure-service.ts` | Исполняемый HTTPS endpoint с TLS 1.3, client CA и exact owner/consumer certificate pins, fixed routes, bounded body/timeouts, no-store, sanitized failures. Только явный `serve-authority` после approved external config. |
| Existing approved-evidence/adapters/controller | Ed25519 verification сохраняется поверх mTLS; authenticated `/consume` делает receipt IDs одноразовыми между процессами. Controller требует durable claim для production receipts до выдачи proof. Fencing reader принимает только purpose=fencing от внешнего host-control issuer; default остаётся null. |
| `infrastructure.config.draft.json`, `authority.*.draft.json` | Только DRAFT, public expected T. Private paths вне repo, три разных principals/keys/ports, общая trusted journal directory, отдельные public anchors. Отсутствующие keys/pins/images/IDs обозначены null, не заменены фиктивными значениями. |
| `Prepare-InfrastructureStorage.ps1` | По умолчанию Preview. Будущий явный provisioning создаёт только новый root и пустой journal, owner/SYSTEM + exact service SIDs, отдельные private dirs и read-only payload/public dirs. Existing root — STOP, без overwrite/delete. Не запускается в этом этапе. |
| `scripts/registration-authority-key.cjs` | Будущая явная Ed25519 генерация, CreateNew/write+fsync, private key только в purpose-dir, public key только в public-dir. Ничего не активирует и не утверждает. Partial failure — STOP, не reuse/delete. На этом этапе не вызывался. |
| `roles-bootstrap.sql`, `observer-after-baseline.sql`, `roles-runtime.sql` | Исполняемые psql scripts, ON_ERROR_STOP, exact cluster/OID/database/version/actor, transactions. Role setup без паролей и LOGIN; narrow observer catalog grants; runtime после exact history 1–7, ownership и empty users. Не применялись. |
| `src/docker-phone-infrastructure-trials.ts` | Executable scenario driver для независимого lab transport: reserved reg_trial_<16hex> names, DDL, GRANT/REVOKE, role/membership, admin ingress, second runner, fencing/process loss, unknown COMMIT и reconciliation. Нет default live transport/setup/migration runner. |

### 13.1 Проверка исходников сейчас

Из корня проекта, без Docker daemon и без SQL:

```powershell
node scripts/registration-infrastructure.cjs validate docker/local-registration/infrastructure.config.draft.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/docker-phone-infrastructure.spec.ts src/docker-phone-access-controller.spec.ts src/docker-phone-access-adapters.spec.ts src/docker-phone-registration-target.spec.ts src/docker-phone-concurrency.spec.ts src/docker-phone-baseline.spec.ts src/docker-phone-migration-preflight.spec.ts
git diff --check
```

Validator сообщает отдельно `structure=VALID` и `execution=BLOCKED`. Это не admission
PASS. Проверка PowerShell — только Parser.ParseFile; SQL-файлы проверены статически,
не PostgreSQL parser/execution. Unit fixtures создают только временные test journals
внутри src и ephemeral test keys в памяти; после тестов fixtures удаляются. Реальные
authority, root/journal, приватные ключи и approvals не создавались.

### 13.2 Что именно остаётся BLOCKED

1. Creation collector/approved owner policy по-прежнему допускают только postgres-test.
   Подготовлен opt-in servicePhase в существующем admission (раздел 14); он требует новой
   отдельно утверждённой phase policy и trusted metadata. DRAFT не является таким допуском.
2. Peer contract теперь допускает ровно вторую authority NIC только при exact control
   network name/ID/config fingerprint и полном составе peers. PostgreSQL в ней запрещён.
   Пока control ID/fingerprint не утверждены, CONTROL_NETWORK_APPROVAL_REQUIRED. Backend имеет
   application/database/mail NICs и также потребует отдельного точного phase-scoped review.
3. Для Node maintenance/observer image нет проверенного pinned artifact digest. Не
   выдумывать digest и не запускать floating tag. Нужны отдельно одобренный artifact,
   provenance, exact version/platform/digest и actual full container/config identities.
4. Windows host не получает PostgreSQL private bridge transport автоматически. Не
   публиковать 5432 и не подменять DNS. Нужны approved broker/peer routes с exact identity;
   source-only draft не является готовым сетевым deployment.
5. Внешний host-control provider не развёрнут. HBA proposal renderer ограничивает auth,
   но не существующие sessions, ownership, CREATEROLE/SET ROLE paths, Docker exec/socket,
   local sockets, background work или администратора хоста. Signed fencing reader —
   проверяющий adapter, не актуация. Нет external proof — EXCLUSIVITY_NOT_ENFORCED.
6. Existing production factory остаётся unprovisioned. Новый explicit mTLS transport и
   durable outcome adapter должны подключаться только reviewed production composition;
   HTTP/env/JSON не устанавливают authority и не открывают migration gate. После SQL
   NOLOGIN credentials/LOGIN/route provisioning остаются отдельными разрешёнными действиями.
7. Journal directory доверяет writer principals и host/storage. Hash chain не защищает
   от злонамеренного host admin, переписавшего весь journal/backup. Storage script даёт
   трём trusted authority services общий journal writer scope; это не sandbox между
   враждебными writers. Для недоверенных writers нужен внешний защищённый single-writer
   service/ledger witness с аутентифицированными commands и independently pinned head.
   Не заявлять межхостовой consensus или anti-rollback против host admin.
8. PHONE_APPLY_CONCURRENCY_VERIFIED=false и APPLY_ELIGIBLE остаются закрыты, даже после
   запуска authority. Real host boundary, concurrency trials и отдельный P0-G обязательны.

### 13.3 Первый infrastructure provisioning — только после отдельного разрешения

Вся последовательность использует только **T** из раздела 1. Старые PostgreSQL,
финансовые проекты, их роли/volumes/networks исключены. Никаких команд ниже в этом
source-only этапе не выполняется.

| Шаг | Preconditions / допустимое изменение | Проверка результата и STOP/recovery |
| --- | --- | --- |
| 1. Fresh admission | Read-only exact daemon/context/container/image/platform/volume/network, затем independently allowed read-only SQL exact T; существующий creation collector не переиспользовать для уже существующего PG, чтобы скрыть collision | Любая замена T или неожиданная схема — STOP. Новый phase admission только после отдельного review, не ручной docker run. |
| 2. Provision principals/storage/keys | P1, независимые service SIDs, owner/reviewer keys и external host boundary; новый C:\approved-registration-infrastructure, без reuse existing root | Preview script, затем отдельно разрешённый ProvisionAfterSeparateApproval; owner/SYSTEM/service ACL inspect. Partial directory/key provisioning — STOP, не remove/overwrite. |
| 3. Observer/migrator и fencing | P3-W: roles-bootstrap.sql только exact empty T; P4: approved HBA diff/ingress + внешнее закрытие privileged entrypoints и существующих sessions | NOLOGIN остаётся до отдельных credentials/route activation. Observer read-only проверяет каталоги. HBA reload/pg_stat_activity сами не доказывают fencing. |
| 4. Concurrency trials | P2/P4/P5: exact pinned peers, независимый lab transport и barriers, только synthetic reg_trial_<run> objects/roles | Выполнить все scenarios, в том числе привилегированный admin path; closed socket/42P01/неперекрывающаяся попытка — не PASS. Доказательства + exact before/after catalog/security. Cleanup только отдельным approved synthetic diff, без CASCADE/user data. |
| 5. Owner approvals | Independent reviewers утверждают before/after/security fingerprints. В authority journal отдельное activate-key, enrollment epoch/session после live transaction, затем B+C/BASELINE | Подписанный owner decision с challenge, exact payload hash, expiry; payload file read-only. Нет подписи/phase/session/epoch matching — STOP. Не auto-approve live snapshots. |
| 6. Baseline 1–6 | P6-A + real gate review, existing runPhoneBaselineBootstrap, baseline phase, known empty T и durable outcome reservation | Никакого generic migration CLI/synchronize. Known COMMIT и exact 6 history/fingerprint. Затем observer-after-baseline.sql только P3-W-6 и новый reviewed security hash. |
| 7. Migration 7 | P6-B/C, новый phone enrollment и session-bound independent B+C, existing runPhoneMigration | Fence через mutations и COMMIT ACK. Unknown COMMIT — pending ledger, STOP/read-only reconciliation, не auto retry/down. Migration order/content unchanged. |
| 8. Runtime role / bootstrap close | P7, confirmed 7 и reviewed catalog. roles-runtime.sql; новая cashback_test NOLOGIN, exact readiness grants, migrator/bootstrap NOLOGIN | Отдельные runtime credentials/LOGIN, termination уже открытых bootstrap/migrator sessions и host boundary по approved diff. NOLOGIN не закрывает existing sessions/host admin. Проверить ownership/effective ACL/memberships. |
| 9. Readiness и isolated apps | P8, reviewed REGISTRATION_POLICY + реальный probe; только теперь отдельное разрешение на backend/Mailpit и frontend 3003 | Schema/history/role privileges и SMTP handshake реальны; без policy/probe остаётся 503. Existing Mailpit guard/allowlist @example.test не менять. App startup отдельный admission/permission. |
| 10. E2E | Отдельно разрешённая регистрация synthetic @example.test с обязательными phone/terms; email link localhost:3003, затем подтверждение, login/profile | Никакого auto-confirm или старых accounts. SMTP/registration failures — STOP, не менять guard/данные. Эти действия сейчас не выполняются. |

Будущие точные tooling commands (SIDs/configs должны быть реально независимо утверждены):

```powershell
# Preview only; переменные содержат утверждённые service SIDs, не passwords.
& .\docker\local-registration\Prepare-InfrastructureStorage.ps1 -FingerprintsServiceSid $fingerprintsSid -ReceiptsServiceSid $receiptsSid -EnrollmentServiceSid $enrollmentSid
# Только после P1: та же команда с -Mode ProvisionAfterSeparateApproval.
# Следующие команды генерируют реальные ключи: требуют отдельного P1, сейчас НЕ запускать.
node scripts/registration-authority-key.cjs generate-after-separate-approval fingerprints fingerprints-v1
node scripts/registration-authority-key.cjs generate-after-separate-approval receipts receipts-v1
node scripts/registration-authority-key.cjs generate-after-separate-approval enrollment enrollment-v1
# Каждый approved config хранится вне Git, не подменяет DRAFT и не равен owner policy.
node scripts/registration-infrastructure.cjs serve-authority C:\approved-registration-infrastructure\public\authority.fingerprints.approved.json
node scripts/registration-infrastructure.cjs serve-authority C:\approved-registration-infrastructure\public\authority.receipts.approved.json
node scripts/registration-infrastructure.cjs serve-authority C:\approved-registration-infrastructure\public\authority.enrollment.approved.json
# Отдельно разрешённое read-only расследование журнала; ничего не unlock/reset/truncate:
node scripts/registration-infrastructure.cjs inspect-ledger C:\approved-registration-infrastructure\ledger
```

TLS server/client credentials и pinned certificate hashes provision отдельно. Reviewer public key
хранится в read-only public-dir и дополнительно закреплён SHA-256 канонического DER/SPKI
в approved config; issuer private-dir не является источником доверия к reviewer. Owner private
review key не размещать у issuer service. Public trust-anchor revision утверждает owner,
клиенты закрепляют именно keyId/SPKI/purpose/issuer/endpoint. Rotation: новый отдельный
private key -> независимое утверждение нового public pin -> signed activate-key -> controlled
client anchor switch -> signed revoke-key старого ID. Revoked key ID нельзя реактивировать;
старые readers должны получить отзыв/reload и инвалидировать leases. Не считать отзыв
в issuer journal мгновенным push во все процессы: до подтверждения client invalidation
boundary остаётся закрытой, существующие envelopes имеют TTL <=4 s.

### 13.4 Crash / частичное выполнение

- wx writer lock не крадётся по PID/expiry. При process loss отключить все writers через
  independently controlled host boundary, сохранить journal/lock/head как evidence и выполнить
  read-only T reconciliation. Не удалять writer.lock ради продолжения.
- Torn tail/hash mismatch/missing log — STOP; никакой auto-truncate/recreate. Восстановление
  только по отдельно утверждённому forensic diff и protected copy/head evidence. Исходник
  намеренно не содержит автоматического writer unlock/repair, потому что живой writer и
  исход последнего fsync нельзя достоверно установить только из файла или PID.
- Durable COMMIT_PENDING резервируется до mutation. Expiry/session restart/новый epoch не
  очищают его. Read-only reconciliation report привязывается к exact T/review/evidence hash,
  независимый reviewer подписывает reconcile action. COMMITTED запрещает повтор того же
  migration review; ABORTED разрешает только новый independently reviewed run после fence.
- Receipt claim сохраняется durable до proof. Потеря ответа consumption — STOP, новый lease
  не переиспользует approval IDs; повтор того же lease идемпотентен. Отзыв enrollment/epoch
  проверяется также в consume, а не только при выдаче envelope.
- Psql scripts имеют BEGIN/ON_ERROR_STOP/COMMIT, не IF NOT EXISTS и не автоматический rollback
  partial provisioning. Неизвестный COMMIT setup также требует read-only investigation.

**STOP. Никакие infrastructure permissions или реальные approvals этим документом не выданы.**

## 14. Final deployment admission review — минимальный source-only patch

**Execution BLOCKED.** Existing approved owner policy, runtime collector invocation и Docker
не изменялись. Создавать новые ресурсы данным разделом не разрешено.

### Минимальная topology до миграций

Три host-side authority процесса (fingerprints:8443, receipts:8444, enrollment:8445),
существующий host-side Access Controller/control-plane с независимым внешним host-fencing
provider, два служебных peer (migration-executor и observer). Итого шесть логических
служебных процессов, два новых helper containers; PostgreSQL — отдельный существующий
процесс/container. Ledger — библиотека/файлы, отдельный сервер для него не добавляется.
Trusted journal writer scope не выдаётся приложению. Самостоятельный privileged host
provider может требовать отдельного management agent: его нельзя выдать за готовый процесс.

| Компонент | Identity / права / storage | Соединения, запуск и STOP |
| --- | --- | --- |
| Fingerprint authority на хосте | Service SID, reviewed Node/source hash, свой issuer/keyId/SPKI, pinned TLS certificate; private key в отдельном purpose-dir | Только exact control-plane interface:8443 с mTLS; без PostgreSQL/admin credentials. Owner-only payloads/public reviewer pin, trusted journal. DRAFT/missing pin/key/ACL, TLS loss или corruption — STOP. |
| Receipt authority на хосте | Отдельный SID, signing key и TLS/owner/consumer pins | :8444, подписанные B/C/BASELINE и durable consume того же lease; no DB/admin. Replay/epoch/enrollment drift или неизвестный consume outcome — STOP. |
| Enrollment authority на хосте | Третий SID/issuer/key, reviewed actual session, exact T/review/security/epoch | :8445, отдельно authenticated observer reports; no mutation credential. Нет достоверного live session — никаких enrollment. |
| Existing Access Controller/control-plane на хосте | Отдельный protected principal, exact deployment/source hashes, independent fencing issuer pin | Read-only daemon metadata и mTLS authorities. Host actuation/broker — только approved external boundary; нельзя выдать raw Docker socket helper/application. Нет external enforcement — EXCLUSIVITY_NOT_ENFORCED. |
| Migration executor peer | Exact full CID/name/project/service, pinned manifest + actual image config ID/platform/config hash; только registration_migrator credential | database:5432 + authority control route, без host ports/Docker socket/volume/admin credentials. Read-only credential binds только нового infrastructure-root. Epoch/session/identity drift — STOP. |
| Observer peer | Свои exact CID/image/config/network identities, только registration_observer credential | Те же две сети, только read-only SQL + authenticated reports. Для existing target factory image обязан содержать psql17. Никаких admin/superuser/DDL/user-table grants. Потеря peer/каталога/mTLS — STOP. |

Сетей для этой фазы две: существующая internal database и одна новая internal authority.
PostgreSQL остаётся ТОЛЬКО в database; authorities остаются на хосте, не добавляются в
PG network. У двух helpers — только эти два NIC, exact network IDs/IP links и полная
проверка membership. Host-side authority listener теперь допускает exact private IPv4,
но не 0.0.0.0. Loopback draft остаётся локальным draft, не считается маршрутом из peer.
Windows/Docker Desktop reachability и ограниченные firewall routes всё ещё требуют
отдельного реального подтверждения; отсутствующую связность не заменять host port 5432.
Backend позже использует application/database/mail topology исходного Compose и остаётся
вне этого helper admission. Нет основания добавлять Mailpit/frontend в служебную фазу.

### Точный admission diff

- Original empty-PG creation branch, TEMPLATE_SHA256, env/secret rules и creation collector
  сохранены. Opt-in servicePhase branch в той же admitRegistrationResources, без нового
  controller/admission engine. Approved policy без servicePhase выдаёт BLOCKED для helpers.
- Новая **отдельно reviewed** phase policy baseline/phone содержит точный manifest file,
  independent template/effective SHA256, полный whitelist двух peers, PG config/network/
  volume hashes и optional exact control network (name/full ID/config SHA). Никаких wildcard,
  автоматического вычисления approval из наблюдения или изменения approved owner policy.
- Fresh complete inventory + exact daemon/context, PG CID/name/project/service/health,
  pinned manifest/actual image ID/linux-amd64, единственный original volume, no PG ports,
  unchanged PG-only network membership. Local volume options не могут подменить storage.
- Helpers: exact full CID/name/service/project/image/config, только whitelist NICs; control
  network не содержит PG/unknown peers. Unexpected ports, privileged/host PID/IPC/devices,
  persistent volumes и binds вне нового protected infrastructure-root запрещены.
- Unknown registration containers/networks/volumes — BLOCKED. Старые проекты могут
  присутствовать в inventory, но не участвуют в invocation, peer list, mounts или networks.
- Branch проверяет уже наблюдаемые running helpers и ничего не запускает. Он НЕ решает
  невозможность знать CID до Docker create. Для первого provisioning требуется отдельное
  разрешение на строго quarantined/stopped создание reviewed immutable artifacts, затем
  owner review реальных CIDs/config/network IDs и отдельный допуск первого start/attach.
  Не подменять CID именем/label, не трактовать synthetic unit PASS как разрешение start.
- Existing CLI collector остаётся creation-only и не принимает caller-written phase facts.
  Перед live helper admission нужно отдельно review/wire его read-only phase collection
  в существующем collector (не новый механизм). Пока этого нет, real service admission
  BLOCKED; обход через ручной run/compose up не допускается.

### Исправленные стыки и recovery

1. Async durable claim теперь сериализует requestEvidence. Второй параллельный запрос
   не получает второй proof для того же lease; claim остаётся durable и ограниченным timeout.
2. Если fsync COMMITTED уже известен, но ACK/fencing потерян после записи, журнал теперь
   разрешает подписанное read-only подтверждение COMMITTED. Нельзя downgrade в ABORTED
   или повторно reserve/apply того же migration review.
3. Target factory получила explicit observationRole=registration_observer через exact
   approved observer peer (не psql из PG container с неправильным source IP). Default
   bootstrap acquisition/legacy random DB не изменены. Same SQL identity/security checks,
   restricted observer membership, private numeric PG address и opaque target proof сохраняются.
4. HBA proposal имеет отдельные setup/runtime-transition scopes: exact controlled-admin /32,
   executor/backend в этих scopes отключены. В baseline/phone/runtime admin entry запрещён.
   External controller обязан закрыть старые privileged sessions/entrypoints до migration
   epoch. NOLOGIN/reload/idle pg_stat_activity сами этого не доказывают.
5. Observer post-baseline grant требует точных шести ordered timestamp/name, а не count=6.
   Migrator создаёт/владеет migration objects; cashback_test появляется только после 7,
   не владеет объектами и получает только readiness DML/sequence/catalog grants.
6. После runtime SQL bootstrap/migrator NOLOGIN, их старые sessions закрываются отдельно.
   Runtime backend использует только cashback_test; observer target/runtime checks больше
   не требуют повторного bootstrap login. Credentials/LOGIN/readiness policy provision
   отдельными разрешениями, иначе приложение не запускается/получает 503.
7. Crash writer оставляет lock; torn tail/missing log — STOP без auto-unlock/truncate.
   mTLS/fencing loss отзывает допуск, unknown COMMIT остаётся pending до reconciliation.
   Partial role/infra creation не даёт права IF NOT EXISTS/reuse/drop/overwrite: independently
   read-only inspect exact T/resources, затем отдельный approved repair diff или STOP.

### Реальные следующие действия — отдельно согласовываются

1. Утвердить external host control/trust boundary, binary/source/image pins, service SIDs,
   TLS/owner/consumer pins и отдельные credentials/ACL; DRAFT и существующую owner policy не
   переименовывать в новый phase approval автоматически.
2. Разрешить только новые quarantined helper artifacts/control network, не PG replacement,
   и получить фактические IDs/config/IPs. Fresh read-only inventory exact T, затем независимый
   review full phase policy/first activation и trusted collector wiring. До этого STOP.
3. Provision защищённого storage/keys/authority процессов с exact private-interface routes;
   никакого PG host port. SQL роли — только отдельно разрешённый setup scope на exact T.
4. Включить enforced boundary, observer acquisition и выполнить отдельно разрешённые
   concurrency/recovery trials. Review доказательств и P0-G обязателен; false gate сохранён.
5. Только после следующего разрешения: baseline 1–6 -> exact observer grant/new fingerprints
   -> новая phone session/B+C -> 7 -> runtime-transition/cashback_test -> close admin paths
   -> runtime HBA/readiness -> отдельно допущенные приложения/E2E. Никакого generic CLI.

Source-review не выполнял Docker inventory/SQL, не читал/менял secrets/approved policy,
не создавал keys/resources, не запускал миграции/сервисы, не затрагивал finance и commit/push.
**STOP: source patch не является live admission PASS.**

Проверки final review: 425 tests / 10 Jest suites PASS (включая old creation collector,
admission/config, legacy Harness, role/network/session/receipt/fencing/recovery contracts).
Backend TypeScript no-emit и scoped test/admission TypeScript no-emit PASS. Offline config:
structure=VALID, execution=BLOCKED. git diff --check PASS. Никакой live admission не запускался.
# Deployment package continuation

The source-only first-start package is described in `FIRST-START-RUNBOOK.md`.
`phase-policy.draft.json` is an unresolved proposal, not an approved owner policy.
The fixed topology remains three host authorities, existing host control-plane,
two helpers and two networks; PostgreSQL remains on database only.
The existing collector now has an explicit post-start service-phase API with
independent daemon collection. Its pre-first-start mode is fail-closed because
the existing authority action contract cannot yet authorize Docker creation.
Package entry points do not execute mutations or accept CLI approval flags.
Unknown helper image digests, identities, mounts, network/config fingerprints,
trust anchors, credentials and external fencing remain deployment blockers.
No creation lifecycle, real independent approval or production reconciliation
is claimed to be deployed. PHONE_APPLY_CONCURRENCY_VERIFIED remains false and
APPLY_ELIGIBLE closed. No runtime policy or original PG-creation gate is changed.
