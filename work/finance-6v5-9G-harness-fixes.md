# Cashback+ — 6В.5.9-З: исправления security harness

14.10.2026. FILES ONLY + OFFLINE VALIDATION. **NOT READY FOR RUN** сохраняется. Ни Docker, SQL, registry, migrations, roles, БД, networks или volumes не запускались/создавались. Реальные credentials не читались/генерировались; digest не выдуманы.

## Изменённые файлы

- infra/finance-security-test/sql/10_boundary.sql — FOUND для admission/auth fences и open/close; IS NOT TRUE для admission/auth; STRICT guard update; NULL context result refusal, epoch>0; status показывает false для отсутствующей/NULL admission.
- infra/finance-security-test/test_security.py — SQL state snapshots до/после permit/deny/rollback; exact generation/n increments; two real concurrent guard mutations; cleanup через checked exit policy и SQL CLOSED verification.
- infra/finance-security-test/compose.yaml — отдельный admission-faults service, только bootstrap secret, explicit tools profile, без автоматического запуска.
- infra/finance-security-test/static_check.py — статические SQL/exit-policy/UTF-8/whitespace assertions.
- infra/finance-security-test/README.md — согласованные команды с явным project/profile, fault service, ограничения и NOT READY статус.
- infra/finance-security-test/VALIDATION.md — результаты и оставшиеся ограничения.

Созданы runner_control.py, test_runner_control.py, test_admission_faults.py в той же директории. Дополнительно создан этот разрешённый отчёт work/. Остальные файлы harness не изменены.

## Исправленные дефекты

**Admission:** только явно OPEN допускает команду; отсутствующая строка отказывает в gate, NULL отказывает через IS NOT TRUE. SQL exception не перехватывается разрешающим fallback. Runtime по-прежнему не имеет private-table DML или admission recovery API. Missing/NULL негативные PostgreSQL проверки подготовлены отдельно: privileged bootstrap выполняет uncommitted fault, переключается на runtime session authorization для probes, сверяет synthetic counter и откатывает transaction. NULL fault временно снимает NOT NULL только внутри откатываемого fixture transaction. Регулярный runtime suite не получает bootstrap credential.

**Exit code:** все suite/cleanup Python exceptions (включая interruption) ведут к exit1. Сохраняются обе error classifications, но не raw secret/SQL details. Aggregate PASS только после successful close+SQL state verification. Failed close/unknown CLOSED не маскируется finally. Offline policy tests подтверждают это поведение без DB imports.

**Guard:** SELECT fs_api.status() проверяет исходные generation/n, разрешённый +1 и возвращаемую версию, неизменность после запрета/rollback; две одновременно разрешённые transactions используют actual blocking barrier и требуют persisted +2. Concurrent revoke требует exact +1 до denial. Synthetic counter не является funding lot, cash, allocation или бухгалтерской истиной.

## Выполненные проверки

- python infra/finance-security-test/static_check.py: PASS AST, denylist, SQL contract text assertions, exit wiring, UTF-8/whitespace.
- python -B infra/finance-security-test/test_runner_control.py: **5/5 PASS** — success, suite failure, cleanup failure, обе ошибки, interruption. Только stdlib, без SQL/psycopg/Docker; -B не создаёт bytecode.
- Manual file consistency: pg endpoint, tools services, secret selectors, project/network/volume names; отсутствие host ports/shared application mounts/docker.sock/privileged mode/init migration hook. Реальные secrets отсутствуют в изменённых файлах; scoped scans не полный secret audit.
- SHA-256 **231** существующих src/test-finance/.gitignore/root Compose файлов совпали. Main HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9, staging пуст, known status ?? infra/, ?? src/finance/, ?? test/finance/.

## Непроверенные условия и блокеры

SQL parsing/function execution/role ACL/transactional fault rollback и concurrency **не выполнялись**. Compose engine validation и Docker CLI live inventory также не выполнялись. Text assertions не заменяют PostgreSQL/Compose acceptance.

PostgreSQL reference: postgres:17-bookworm@sha256:REPLACE_WITH_REVIEWED_DIGEST — неподтверждённый placeholder. Python base: python:3.13-slim-bookworm — mutable tag, digest/patch/platform не установлены. Требуется отдельно разрешённое registry-only resolution manifests/index и выбранной platform, затем reviewed pins; никаких pull. Dependencies/wheel hashes, secret readability UID65534, fresh credentials/external paths, resource creation manifest, installer separation и production issuer/reopen contract остаются непроверенными.

Новые privileged fault tests предназначены только для отдельно идентифицированной isolated test DB, не production/root/shared cluster. Default suite остаётся synthetic prototype, без реального lot guard cutover/AppModule/начислений/выплат. Complete mixed-isolation, full grant matrix и crash recovery вне выполненной offline проверки.

Следующий безопасный шаг: повторный read-only review исправлений и разрешённое подтверждение образов/Compose config; инфраструктуру и SQL запускать только по отдельному разрешению. Код Cashback+, main/finance DB, Docker volumes, frontend, old business modules/.gitignore сохранены. Commit/push/pull/fetch не выполнялись. После отчёта остановка.
