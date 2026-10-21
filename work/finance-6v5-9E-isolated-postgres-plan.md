# Cashback+ — 6В.5.9-Д: план изолированного PostgreSQL security testing

Дата 14.10.2026. DESIGN + READ-ONLY FILE AUDIT. Только этот документ создан. Все конфигурации и команды ниже предлагаются для будущего отдельно разрешённого этапа; не созданы и не выполнены.

## 1. Вывод аудита

Источники: проекты 9A–9D, compose.yaml, finance test runner/README и текущий finance-контур. Сохраняются 9C/9D lock/ACL/freshness/cutover contracts, effect-only generation и максимум три попытки. Роли разрешены исключительно в НОВОМ отдельном instance, не в общем postgres-test.

Файлы описывают compose project cashback-docker-test, postgres:17-bookworm, сервис postgres-test, volume postgres-test-data и DB cashback_docker_test. Историческая finance DB cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77 находится в том же cluster 7695793866029359141; runners фиксируют OID 24780/IP 172.18.0.2 и роль cashback_test. Они используют process.env.DB_PASSWORD, не отдельные installer/runtime identities. Это file evidence, не сегодняшняя live inventory. Никаких секретов не приведено.

По предыдущему аудиту Docker CLI недоступен; в этом этапе Docker не запускался, альтернативные пути доступа не искались. Нельзя утверждать, какие контейнеры фактически работают, что имя свободно или что отдельной среды нигде нет. Порты/сети/mounts/live roles не проверены. HEAD main/1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9, staging пуст; известные untracked src/finance/ и test/finance/.

## 2. Архитектура нового instance

Предлагаемый project: `cashback-finance-security-9e`. Отдельный service `finance-security-pg`, новая named volume `cashback-finance-security-9e_pgdata`, новая сеть `cashback-finance-security-9e_private`. DB `finance_security_test`; bootstrap identity `fs_bootstrap` (НЕ runtime). Имена — предложение, collision check обязателен; при существующем одноимённом объекте STOP, не adopt.

Нет host ports: PostgreSQL слушает 5432 только внутри новой сети. Значит host 5432/5433 не переиспользуются и конфликт host-port исключён конфигурационно; live binds всё равно inventory. Отдельные installer/test executors соединяются с finance-security-pg:5432 только этой сетью. Existing backend/postgres-test/main/finance DB к ней не подключаются. Никаких external networks/volumes, host network, host-gateway, Docker socket, privileged mode, shared PGDATA или application env. Runner не получает основные/старые finance credentials.

Network internal=true уменьшает внешний доступ, но не гарантирует запрет атакующему с Docker-admin/host полномочиями. [Docker network documentation](https://docs.docker.com/reference/compose-file/networks/) описывает эту сетевую изоляцию. Для более сильной host boundary нужен отдельный Docker engine/VM: отдельное решение владельца. Перед acceptance проверить routes и невозможность подключения к старым endpoints безопасными connection probes без credentials; отсутствие маршрута не подменять наличием непредъявленного пароля.

Independent lifecycle: отдельный compose file/project, новые labels, ресурсный manifest с точными IDs. Existing compose.yaml не редактировать/не использовать через override. Instance сохраняется между тестами, никаких automatic down -v/reset. Synthetic fixtures новые, данные не копировать из работающих DB. Crash/restart tests только новой среды отдельной фазой.

## 3. Предлагаемые файлы (сейчас существуют только как текст)

| Будущий файл | Назначение |
| --- | --- |
| docker/finance-security/compose.yaml | Standalone PG/service+network+volume, без app services |
| docker/finance-security/compose.env.example | Только paths/images/non-secret settings |
| docker/finance-security/README.md | Inventory/provisioning/run/retention/removal procedures |
| test/finance-security/identity-manifest.json | Reviewed new environment identity, schema/artifact digest, secret values отсутствуют |
| test/finance-security/run-security.cjs | Strict preflight и multi-LOGIN concurrency suite, без DB fallback |
| test/finance-security/migration-data-source.ts | Explicit finance-only ordered migration allowlist, no AppModule |
| test/finance-security/runtime-data-source.ts | Explicit restricted LOGIN; synchronize/migrationsRun=false |
| docker/finance-security/provision-roles.sql | Только reviewed new cluster; separate credential injection, не literal passwords |

Новый config не давать production process и не менять старые runners. SQL API/guard/authority migrations ещё не реализованы; новый instance сам по себе не делает текущий код безопасным.

### Standalone Compose draft

```yaml
name: cashback-finance-security-9e
services:
  finance-security-pg:
    image: ${FS_PG_IMAGE:?Set reviewed PostgreSQL 17 image with digest}
    environment:
      POSTGRES_DB: finance_security_test
      POSTGRES_USER: fs_bootstrap
      POSTGRES_PASSWORD_FILE: /run/secrets/fs_bootstrap_password
      POSTGRES_INITDB_ARGS: --auth-host=scram-sha-256 --auth-local=scram-sha-256
      PGDATA: /var/lib/postgresql/data/pgdata
    secrets: [fs_bootstrap_password]
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [private]
    restart: "no"
    labels:
      com.cashback.finance-security.scope: isolated-9e
    healthcheck:
      test: [CMD, pg_isready, -h, "127.0.0.1", -p, "5432", -U, fs_bootstrap, -d, finance_security_test]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 15s
networks:
  private:
    name: cashback-finance-security-9e_private
    internal: true
    labels:
      com.cashback.finance-security.scope: isolated-9e
volumes:
  pgdata:
    name: cashback-finance-security-9e_pgdata
    labels:
      com.cashback.finance-security.scope: isolated-9e
secrets:
  fs_bootstrap_password:
    file: ${FS_BOOTSTRAP_SECRET_FILE:?Set new secret file outside repository}
```

No container_name: project-scoped name avoids global hardcoding; manifest records actual returned container ID/name, never assumes generated suffix. Explicit network/volume names are global and MUST be collision-checked. Image value should be reviewed `postgres:17-bookworm@sha256:<verified digest>`; digest не выдуман. Init flags/new PGDATA test on empty new volume; existing volume never silently initialize/reuse. `_FILE` и PostgreSQL17 data mount применяются согласно [official image](https://hub.docker.com/_/postgres). Bootstrap образа является privileged identity, поэтому его secret только PG bootstrap и отдельный approved installer executor, никогда runtime.

Healthcheck лишь readiness, не authenticated DB identity/ACL/schema acceptance. SCRAM secures authentication, не шифрует весь traffic: первоначально только isolated synthetic data. Production TLS/cert policy отдельно; не делать sslVerify=false/fallback. Fresh secrets independent per LOGIN генерировать после разрешения вне repo, с ограниченными Windows ACL; не выводить env/config secrets. Secret files Compose не объявлять encrypted vault. Example env содержит только FS_PG_IMAGE/FS_BOOTSTRAP_SECRET_FILE; никаких DB_PASSWORD/DATABASE_URL/JWT старой среды.

Executors: будущий отдельный one-shot Node runner image с заранее собранными finance modules/dependencies, только private network, no socket/no app env/no main volumes; каждый process получает только нужные password files. Runtime suite не получает bootstrap/installer secret. Поскольку существующий backend executor обладает старым DB env, его здесь не использовать. Build/pull зависимости отдельно до private execution; image digest и artifact hash фиксируются. Не скачивать пакеты из тестовой transaction.

## 4. Transaction-bound identity: конкретная модель isolated тестов

Выбранный для предложения вариант A из 9D: настоящие DB LOGIN identities, owner-private identity registry и server-bound context. Это технический prototype, не утверждение human identity из UUID и не план DB login для каждого коммерческого пользователя.

Trusted fixture identity issuer под offline bootstrap создаёт проверенные synthetic principalId/participantId и immutable mapping LOGIN→principal→participant; два alias accounts одного участника имеют одинаковый participant. Production issuer остаётся disabled. Ordinary runtime не mint/grant/изменяет registry. Authenticated PostgreSQL session_user определяет caller; current_user внутри definer — owner и не используется как principal. У runtime нет membership/SET ROLE, позволяющих имитировать другой LOGIN/owner; SET SESSION AUTHORIZATION чужого пользователя denied.

Protected function:

1. Проверяет supported protocol/isolation, active caller transaction; gate (726405,0) и admission/auth conflicting UPDATE fences.
2. Находит current active verified principal/participant по session_user, проверяет scoped right/identity version/grant version/auth epoch в private store.
3. Создаёт private context с server-generated context ID, full transaction ID (`pg_current_xact_id()`), backend PID, DB OID, cluster/environment identity, caller LOGIN, principal/participant/version vector. Эти данные вычисляет функция, не payload/GUC. [PostgreSQL system information functions](https://www.postgresql.org/docs/17/functions-info.html) описывают session/transaction identity primitives.
4. Каждая command сверяет server tuple и перечитывает current rights внутри тех же locks; context не cached grant. Caller не имеет DML/SELECT/private helper EXECUTE; contextId допустим как selector, не полномочие. COPY чужого ID/новый transaction/reused connection/PID reuse/same participant alias не обходят binding/независимость.
5. DB command и all domain/ledger/outbox изменения остаются одной outer transaction; context и эффект откатываются вместе. Transaction commit делает context historical/unusable. Нет автоматического cleanup, влияющего на audit; retention policy отдельно.

Issuer удостоверяет synthetic identities только в тестах; DB удостоверяет login possession через SCRAM + restricted role config. Реальный responsible participant требует независимого trusted identity onboarding; общего service login для arbitrary humans недостаточно. Production shared-pool gateway/capability вариант остаётся отдельным проектом, не synthetic fallback.

Revoke API доступен только authority identity и использует тот же gate/fences. Grant/identity disable + version/epoch increment + audit atomic; линейная точка revoke COMMIT. Command-first revoke ждёт, revoke-first command deny. SS stale snapshot после concurrent update -> 40001/fresh retry; RC rereads current state. Advisory lock один не решает freshness. TOCTOU исключается удержанием общей блокировки до commit и запрещённым прямым DML. Missing/current issuer unavailable/unknown identity -> deny. Внешний JWT/cache не authority truth.

## 5. Роли и admission

| Роль | Может | Не может |
| --- | --- | --- |
| protected owner NOLOGIN | Own tables/private functions | Быть runtime member/login |
| installer | Offline schema/ACL, approved owner SET ROLE | Передавать credential runtime |
| deployment operator | close/status/request reopen narrow APIs | Money DML, произвольный SQL/grants |
| reopen approver/auditor | Verified acceptance для exact manifest, review permission evidence | Самостоятельные финансовые writes |
| authority issuer/writer | Scoped verified mapping/grant/revoke APIs | Runtime money/own-free; direct registry bypass |
| runtime LOGINs | Exact allowed function calls/current rights | Admission open, table DML, DDL, installer/owner SET ROLE |
| fixture identity | Synthetic preparation only CLOSED | Конкурентные fixtures при live acceptance/production |

Reopen требует trusted acceptance record и актуальный schema/code/DB manifest, не caller bool. Operator выполняет финальный переход, approver подтверждает acceptance; раздельное approval — рекомендуемый выбор для утверждения. При отказе/unknown record CLOSED. Default permissions owner-private; PUBLIC EXECUTE revoked, safe fixed search_path/schema-qualified references; installer и issuer никогда не в runtime pool. Bootstrap/admin остаются привилегированной административной границей.

## 6. Будущая inventory без изменений

Команды ниже не выполнены. Если Docker CLI отсутствует — остановить live часть, не искать обход через другой daemon/API/WSL. Никаких выводов о реально запущенных контейнерах.

```powershell
Get-Command docker -ErrorAction SilentlyContinue
docker version
docker ps -a --format '{{.ID}} | {{.Names}} | {{.Image}} | {{.Ports}}'
docker network ls
docker volume ls
# После выбора exact nonsecret IDs выводить только отфильтрованные поля:
docker inspect --format '{{json .Mounts}}' <exact-container-id>
docker inspect --format '{{json .NetworkSettings.Networks}}' <exact-container-id>
docker volume inspect <exact-volume-name>
docker network inspect <exact-network-name>
```

Не выводить полный container inspect/Compose resolved config: там могут быть секреты. Для proposed новой среды до creation имена должны отсутствовать; для later preflight existing IDs сверять с creation manifest. Новая сеть не должна содержать старые containers; new volume не должен быть смонтирован старым instance. Отсутствие host ports проверять, не предполагать только по YAML.

Future authenticated read-only SQL admin preflight после разрешения запуска новой среды:

```sql
BEGIN READ ONLY;
SELECT current_database(), session_user, current_user,
       inet_server_addr(), inet_server_port(), current_setting('server_version_num');
SELECT system_identifier FROM pg_control_system();
SELECT oid, datname FROM pg_database WHERE datname=current_database();
SELECT rolname,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles;
SELECT * FROM pg_auth_members;
ROLLBACK;
```

Cluster ID должен отличаться от старого; DB/OID/roles/mounts/endpoint получают approved manifest. pg_control_system не выдавать runtime ради preflight. Shared environment credentials не использовать даже для отрицательных probes.

## 7. Порядок будущего развёртывания

1. Отдельное разрешение новых файлов/instance/storage/network/credentials/roles/tests и retention. Проверить имена/engine/образ/disk budget без mutations. STOP при unknown target.
2. Создать только new secrets и reviewed standalone configs. Schema/tests ещё не запускать. Не объединять с existing Compose.
3. Запустить только новый PG service через exact file/project; результат creation (IDs, timestamps, mounts/network/image digest) фиксируется в manifest. Proposed команда после разрешения: `docker compose --project-name cashback-finance-security-9e --env-file <new-nonsecret-env> -f docker/finance-security/compose.yaml up -d finance-security-pg`. Сейчас НЕ выполнена.
4. Health + identity preflight; cluster mismatch/fresh-volume proof. Bootstrap выполняет reviewed provisioning ограниченных identities, admission CLOSED. Без полного guard package routine writers остаются закрыты.
5. Применить finance-only migration allowlist на новый пустой schema через installer. Девять существующих migrations по порядку + будущий согласованный guard/auth/ACL пакет; не root AppDataSource и не старый runner с фиксированной historical identity. Schema/history preconditions exact, synchronize=false/migrationsRun=false. Никаких main business migrations.
6. Подготовить synthetic fixtures при CLOSED. Зафиксировать денежные baseline. Убрать fixture executor/secret из acceptance processes.
7. Deploy coordinated inactive adapters/API; all writers/use readers входят в guard. Permission tests настоящими runtime LOGIN; current production default deny отдельно проверить. В isolated context открыть только разрешённые synthetic principals после approval/manifest.
8. Multi-connection acceptance suite и closed cutover failures; после suite CLOSED/retain. Не подключать AppModule/app/backend/банки.

План исполним после создания перечисленных будущих артефактов; сегодня отсутствующие API/migrations/runner нельзя выдавать за готовые scripts. Никакого частичного cutover в существующей finance DB.

## 8. Критерии успешности

- Разные cluster/PGDATA/volume/network/credentials; старые environments недоступны runner; exact manifest/roles проверены.
- Runtime raw INSERT/UPDATE/DELETE/TRUNCATE/COPY/DDL/SET ROLE/private helper/reopen denied; protected table ACL/owners/defaults и callable chain проверены.
- Context forgery/GUC/payload/stale JWT/other session/xid denied; same-participant alternate LOGIN не self-approval.
- Concurrent authority revoke/RC-SS snapshot, evidence revoke/reservation, две reservations, classification metadata/reservation подтверждены реальными A/B sessions и blocking barriers.
- Old writer/CLOSED/active transaction cutover/failed migration сохраняют closed boundary; runtime не может открыть admission.
- Receipt genesis/replay, candidate/decision legacy/cross-request constraints, restricted lots совместимы; guard-only phase не меняет money/journal/outbox/allocations.
- Whole rollback, max3 definite transient retries и unknown-outcome reconciliation; нет real apply/income/обязательств/payments.

Это acceptance план, не выполненные результаты. Unit или sequence tests не заменяют concurrency/permissions checks.

## 9. Очистка и безопасное удаление

Во время tests данные сохраняются; не TRUNCATE/reset/пересоздавать volume для повторов. Использовать новые namespaced fixtures и exact baseline. Retention/report snapshots без секретов. Если требуется fresh schema, отдельный разрешённый новый instance/run ID, не wipe неизвестной DB.

Удаление новой среды — отдельное разрешение владельца после audit/archive. Перед deletion operator CLOSED, drain точных sessions; сверить absolute config path/project, manifest container IDs, exact volume ID/labels, network attachments, mounts и отсутствие старых containers/реальных данных. При несоответствии STOP. Сохранить отчёты/manifest/необходимый approved backup; secrets удалять только новой среды по отдельной процедуре.

После проверки можно stop/remove только перечисленные new resources; сначала контейнеры, затем новая сеть, затем только явно подтверждённый новый volume. Не `docker system prune`, не wildcard, не global volumes prune, не compose down -v на existing project. Процедура removal ещё не выполняется и не является текущим разрешением. Если archive нужен, volume оставить до отдельного разрешения удаления.

## 10. Риски и решения владельца

Нужно разрешить: новое instance/volume/private network и отдельные secret files; будущие конфиги/runner/provisioning; concrete test LOGIN→synthetic participant mapping; operator/installer/issuer/auditor/reopen separation; retention/deletion policy; bounded operational timeouts. Production human issuer/shared pool binding остаётся отдельным вопросом. Тарифы, safety reserves, business TTL не назначены.

Риски: host/Docker admin bypass; reuse глобального имени/volume; installer secret в runtime; shared app DS fallback; unchecked PUBLIC/default grants; SS stale snapshot; смешанные writers; deadlocks от rank inversion; старые runner history guards; недостаток ресурсов; ошибочное удаление. Любое неизвестное состояние — STOP/CLOSED, не fallback.

Рекомендуемый следующий этап — отдельно разрешённое provisioning только этой новой isolated среды, затем coordinated inactive protocol package и synthetic security suite. Сейчас инфраструктура не создана, готовность production не заявляется.

## 11. Контроль выполнения

Создан только work/finance-6v5-9E-isolated-postgres-plan.md. Docker/SQL/roles/DB/migrations/tests не запускались; config/credentials/src/frontend/FinanceModule и existing volumes не изменены. Commit/push/pull/fetch не выполнялись. SHA-256 всех 234 baseline файлов совпали; status сохранил только известные ?? src/finance/ и ?? test/finance/, staging пуст. Whitespace check без ошибок; LF/CRLF warning не изменил index. После отчёта остановка.
