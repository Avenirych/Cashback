# Cashback+ — 6В.5.9-Ж: security harness preflight

Дата 14.10.2026. READ-ONLY VALIDATION. **НЕ ГОТОВ к первому изолированному запуску.** Создан только этот отчёт; найденные дефекты не исправлялись. Docker/SQL/integration tests не выполнялись.

## 1. Проверено и ограничения

Прочитаны все 13 файлов infra/finance-security-test: README, VALIDATION, Compose, Dockerfile, env example, requirements, 2 SQL-файла, common/provision/inventory/test_security/static_check Python. Повторный offline static_check прошёл: AST без импорта DB runner, text denylist, отсутствие запрещённых Compose параметров. Это не SQL parser, Compose schema validator, secret scanner или integration result.

`Get-Command docker` не нашёл CLI; стандартный Docker executable path также отсутствует. Compose version/config НЕ проверены. Альтернативные daemon/WSL/API не использовались. Live контейнеры/networks/volumes/roles/credentials неизвестны. Нельзя считать текстовый static PASS успешной Compose или SQL проверкой.

Файлы согласованы по service pg, endpoint pg:5432, DB finance_security_test, project cashback-finance-security-9f, network cashback-finance-security-9f_private, volume cashback-finance-security-9f_pgdata. README команды указывают отдельный Compose file, --no-deps для one-shot runs. Рекомендуется также явно добавлять `--project-name cashback-finance-security-9f` и `--profile tools` вместо зависимости только от name/service selection.

Пароли читаются только из /run/secrets/bootstrap|installer|runtime|authority|operator; SQL создаёт соответствующие fs_* identities; tests не получают bootstrap/installer secret. Реальных credentials в рассмотренных файлах не обнаружено. Это scoped manual review, не утверждение отсутствия секретов во всём репозитории. Existing .gitignore не менялся; arbitrary secret filenames под infra не защищены общей ignore policy. Real files должны быть вне repo/build context и независимо проверены перед deploy.

Нет host published ports, docker.sock, privileged/host networking/external volumes, mounts проекта или app env. Private internal network и отдельная PGDATA заданы; live отсутствие старых network attachments/mount reuse не подтверждено. Host/Docker admin вне границы защиты. SQL не запускается entrypoint/initdb автоматически: provision.py — явный будущий install; root application migrations не импортированы.

## 2. Образы и воспроизводимость

| Компонент | Фактически задано | Статус |
| --- | --- | --- |
| PostgreSQL | FS_PG_IMAGE; пример postgres:17-bookworm@sha256:REPLACE_WITH_REVIEWED_DIGEST | Major17/bookworm намерение, placeholder не валидный digest; patch/platform/content неизвестны |
| Harness builder/runtime | python:3.13-slim-bookworm | Mutable tag, patch/content неизвестны; digest отсутствует |
| Python dependency | psycopg[binary]==3.2.10 | Version pinned, wheel availability/hashes/supply chain здесь не проверены |

Registry manifest не запрашивался, Docker отсутствует; **достоверные digest не установлены**. Не придумывать значения и не считать major tag конкретным immutable образом. Перед запуском отдельно разрешить registry-only metadata resolution без pull: выбрать архитектуру, записать manifest/index digest и platform digest для PostgreSQL17 и Python3.13, проверить доступность и затем согласовать pin файлов. Dependency hashes/verified wheel index тоже нужны для строгой воспроизводимости. Dockerfile пока не закреплён digest; реальный FS_PG_IMAGE не контролируется regex/version validator до запуска контейнера (SQL preflight лишь позднее проверяет17).

Остановка до разрешения registry/digest подготовки и исправления harness. Никаких pull/build/up/run/exec/config в этом этапе не выполнено.

## 3. Security review и найденные дефекты

### F01 — fail-open отсутствующей admission row (блокер)

В fs_private.check_authority() используется `IF NOT (SELECT open ... WHERE id=1)`. При отсутствии строки scalar subquery даёт NULL; NOT NULL остаётся NULL, IF не входит в ветвь отказа. lock_gate UPDATE без row-count проверки также молча обновляет ноль строк. При сохранённом auth/identity/context функция touch_guard может изменить protected counter без admission row. Runtime сам удалить её не вправе, но corrupted/incomplete control state обязан fail closed.

Необходимое исправление: exact singleton checks/SELECT INTO STRICT, `IS NOT TRUE`, row-count assertions для admission/auth/guard updates, explicit missing-control error; tests через fenced privileged fixture создают missing-row scenario и требуют отказ+zero mutation. Не изменять денежные данные для этой проверки. Null-проверка следует семантике PL/pgSQL; [официальная документация](https://www.postgresql.org/docs/17/plpgsql-statements.html) описывает STRICT и поведение отсутствующей строки.

### F02 — финальное закрытие не влияет на exit code (блокер)

test_security.py finally ловит close failure, печатает предупреждение и не устанавливает failure status. После успешного main возможен exit0 при неподтверждённом CLOSED. PASS count выводится до финального close.

Исправление: сохранять общий result, close+independent status verification до итогового PASS; failure/unknown CLOSED -> nonzero exit, отдельный reconciliation reason. Любая ошибка observer/close не скрывает исходную failure и не даёт ложного success.

### F03 — изоляция/secret provenance только инструкция (predeployment блокер)

common.identity проверяет DB name/version/expected cluster и исключает один historical ID, но не creation manifest, mounts/networks/actual role flags/DB OID. Expected ID задаёт caller env. Это полезная защита от случайной ошибки, не независимое доказательство нового instance. Путь secret вне repo также не проверяется программно; distinctness/length не доказывают fresh generation. При неправильном env/присоединении networks runner всё ещё может обращаться к нежелательной среде.

Нужны independently reviewed resource/creation manifest, exact identity/role/mount checks до provisioning и проверка внешних absolute secret paths/ACL/new-secret attestation. Не создавать роли по одному DB name или самостоятельно утверждённому FS_EXPECTED_CLUSTER. Новая роль fs_runtime NOLOGIN существует, но не используется grants/membership — документацию уточнить либо использовать осмысленно, не добавлять owner membership.

### F04 — tests не доказывают положительный guard effect (test readiness)

binding() вызывает touch_guard, но не проверяет рост n/generation относительно baseline. Если функция станет no-op, положительный test и rollback snapshot могут пройти. Negative SQL tests ожидают42501, но не сверяют snapshot после каждого отказа. Добавить exact positive delta, returned generation, no-effect-after-denial assertions и недостающую проверку прямого COPY/DDL/изменения registry/context.

### F05 — singleton/counter и audit contracts неполны

touch_guard UPDATE RETURNING INTO без FOUND/STRICT допускает NULL result, если protected row отсутствует. Нет epoch>0 и полного контракта version overflow; immutable audit не защищён от privileged owner, что является административной границей. Prototype не содержит typed scoped grants/identityVersion/version-vector и раздельного human identity onboarding. Требуется явно ограничить утверждения моделью одного synthetic LOGIN и глобального enabled/epoch, а не полной системой полномочий production.

### F06 — bootstrap устанавливает всё, installer роль не используется

provision.py выполняет SQL через fs_bootstrap, затем выдаёт passwords. fs_installer создаётся/получает owner membership, но не выполняет install и не получает USAGE fs_api для inventory. Это не runtime bypass, но нельзя заявлять, что installer separation протестировано. Future install нужно либо явно обозначить bootstrap-only первоначальным шагом, либо разделить bootstrap roles и installer object deployment с отдельной identity/secret boundary. Нельзя менять роль/ownership до выполнения SQL acceptance.

### F07 — финальный harness не production cutover

open_synthetic_admission доступен operator без independent acceptance/manifest check. Это прямо помечено test-only; не vulnerability runtime, но не реализация9C controlled reopen. Authority также global on/off и synthetic identity. Production default deny обеспечен отсутствием интеграции, а не отдельным production runtime flag в этом package. Запретить deployment этих файлов в app/production.

### F08 — воспроизводимость и execution portability

Неподтверждённые image digest блокируют старт. USER65534 требует проверки читаемости Compose file secrets на выбранном Docker backend/Windows bind semantics. Пакеты не устанавливались; tool network internal требует dependencies уже в образе. README placeholders `<external-env-path>` не исполнимы в PowerShell до замены на quoted absolute path. Для schema/config проверки не использовать full rendered config с секретами.

## 4. DB boundary: что видно статически

Положительные свойства: owner NOLOGIN; runtime без owner/installer membership и SUPERUSER/CREATEROLE/BYPASSRLS; PUBLIC EXECUTE/default owner functions revoked; runtime EXECUTE только begin_context/touch_guard/status/cluster_identity; private schema/table/sequence DML не выдан. SECURITY DEFINER функции создаются под SET LOCAL ROLE fs_owner, safe fixed search_path=pg_catalog,pg_temp, table/helper names qualified; dynamic SQL нет. pg_control_system право owner явно выдано. fs_api.cluster_identity — узкий test-only observer, не raw pg_control_system runtime grant.

session_user (не current_user owner) связывает LOGIN с fixture principal/participant; context содержит xid8/PID/login/epoch, current identity join и current auth recheck под shared gate. Это разумный synthetic transaction binding; подделка SET LOCAL не должна давать access. DB/database/cluster поля в context отсутствуют, cross-instance lookup предотвращается локальной таблицей, однако нельзя заявлять полный version vector проекта9D. Actual grants/function execution и PostgreSQL parsing НЕ проверены.

Global gate и conflicting admission/auth UPDATE связывают revoke и command до outer commit. Command-first/revoke-first commit order теоретически совместим. Advisory lock не refresh SS snapshot; mixed isolation safety требует реального SS stale snapshot test, которого suite не содержит. [PostgreSQL locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html) объясняет transaction-scoped advisory locks; их наличие не является выполненной concurrency проверкой.

## 5. Матрица способности тестов

| Нарушение | Существующая проверка | Пробел |
| --- | --- | --- |
| Direct SQL | INSERT/UPDATE/DELETE/TRUNCATE private table,42501 | COPY/DDL/ACL catalog, invariant snapshots отсутствуют |
| Role/function escalation | SET ROLE owner/installer, SET SESSION AUTHORIZATION operator, private helper/open | Overloads/shadow lookup/PUBLIC effective memberships не проверены |
| Fake context | random ID + GUC; reused context после commit | Другой real LOGIN/same participant alias, NULL/missing controls не проверены |
| Concurrent revoke | Real thread, pg_blocking_pids barrier, command-first, later denial | Revoke-first race/RC-SS matrix отсутствуют; auth fields ограничены |
| CLOSED | begin_context denied после close | Начальный default CLOSED до setup не проверен; valid historical ctx while CLOSED не проверен |
| Guard bypass | Raw/private denials и approved touch | No-op guard может пройти; отсутствие control не проверено |
| Rollback | Counter snapshot before/after outer rollback | Positive effect assertion отсутствует |
| Failed cutover | open + SELECT1/0 rollback, CLOSED assertion | SQL install failure/ACL transaction rollback/active txn drain не проверены; это только rollback gate toggle |

8 grouped tests существует по коду, но **ни один PostgreSQL test здесь не выполнен**. PASS static checker не покрывает эти сценарии. Без дополнительных tests нельзя принимать полный security/cutover package.

## 6. Следующий безопасный шаг и ограничения

До первого старта: разрешить исправление F01/F02 и тестов F04/F05; уточнить bootstrap/install scope; prepared verified manifest/secret path guard; подтвердить image/dependency metadata; затем отдельно получить Docker Compose version/config --quiet validation с exact -f и -p (без запуска/secret выводов). Registry metadata permission не означает pull.

После исправления повторный FILES ONLY audit; отдельно разрешить создание новой среды, roles/SQL и synthetic integration suite. Existing finance DB/cluster не target. Не применять эти probe functions к реальным lots и не подключать AppModule.

Code/harness/Compose/SQL не исправлены данным аудитом. Main/finance DB, credentials, Docker/resources/roles не изменены. Git commit/push/pull/fetch не выполнялись. Known status: ?? infra/, ?? src/finance/, ?? test/finance/, staging пуст, HEAD1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9. SHA-256 всех 69 baseline файлов совпали; whitespace check нового отчёта без ошибок. До устранения блокеров и отдельного разрешения — остановка.
