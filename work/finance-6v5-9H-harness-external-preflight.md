# Cashback+ — 6В.5.9-И: внешний preflight harness

14.10.2026. READ-ONLY PREFLIGHT. **NOT READY FOR ISOLATED TEST RUN**. Только новый отчёт; harness/src/конфигурации не изменены. Никаких контейнеров/SQL/миграций/roles/credentials/resources не создано и не запускалось.

## 1. Подтверждённые проверки

Прочитаны README/VALIDATION, отчёты9F/9G, Compose/Dockerfile и Python/SQL harness. По файлам исправления9G присутствуют:

| Исправление | Наблюдаемый код | Статус |
| --- | --- | --- |
| Admission missing/NULL | FOUND после UPDATE fences; admission/auth IS NOT TRUE; status IS TRUE | Подтверждено статически, не SQL execution |
| Negative fault tests | missing/NULL injection в отдельной bootstrap transaction; runtime session authorization probes; rollback | Подготовлено, PostgreSQL не выполнен |
| Exit code | run_checked сохраняет suite+cleanup errors; exit1 при любом failure; CLOSED SQL verification до aggregate PASS | 5 offline tests PASS |
| Guard | generation/n SELECT snapshots +1/+2, denial/rollback checks, реальный blocking barrier в будущих tests | Код присутствует; concurrency не выполнена |
| Runtime admission boundary | No private-table DML grants; open function только operator; runtime negative tests | Статически подтверждено, ACL catalog неизвестен |

Повторно выполнены `python infra/finance-security-test/static_check.py` и `python -B infra/finance-security-test/test_runner_control.py`: PASS и **5/5 PASS**. Только stdlib/AST/text проверки, без импорта DB runner/psycopg и без bytecode writes. Не заявляется, что SQL парсится/исполняется или Compose engine принял файл.

## 2. Docker/Compose и итоговая конфигурация

Get-Command docker не нашёл CLI; стандартный Windows Docker executable path отсутствует. Compose version/config НЕ выполнены. Windows/Docker Desktop state, server platform, running containers/mounts/networks неизвестны; альтернативный daemon/WSL/API не использовался.

Исходный Compose: project cashback-finance-security-9f; services pg/inventory/admission-faults/installer/tests; только network private internal=true; новый named volume cashback-finance-security-9f_pgdata; no host ports. PG endpoint в common.py строго pg:5432/finance_security_test. Нет external network/volume, host networking, docker.sock, privileged, project/main data mounts, application DB env или init migration hook. SQL install только explicit provision.py, не startup PostgreSQL hook.

Итоговая rendered конфигурация НЕ проверена. Env override может указать неподходящий image/secret path; глобальные resource names могут уже существовать. Отсутствие доступа к действующим PostgreSQL подтверждено только отсутствием явных ссылок/общих сетей в файле, не live network test. Secret свежесть/external paths/ACL/readability UID65534 требуют проверки перед deployment. Scoped review файлов не обнаружил реальных secret values; не whole-repository secret audit.

## 3. Образы, архитектуры и immutable digest

| Reference | Что достоверно | Что неизвестно |
| --- | --- | --- |
| FS_PG_IMAGE; example postgres:17-bookworm@sha256:REPLACE_WITH_REVIEWED_DIGEST | Намерение PostgreSQL17/bookworm; placeholder не реальный digest | Exact patch, registry index/platform digest, supported/selected architecture |
| Dockerfile python:3.13-slim-bookworm | Намерение Python3.13/slim/bookworm, mutable tag | Exact patch/content/digest/selected architecture |
| psycopg[binary]==3.2.10 | Пакетная версия в requirements | Wheels/platform availability/hashes не проверены |

Compose не содержит platform. Нельзя предположить linux/amd64 только из Windows пути; Docker engine может быть ARM64/Linux или Windows container mode. Для этих Linux-образов нужен проверенный Linux engine/platform и совместимые manifests.

Read-only web попытки доступа к Docker Hub metadata endpoints для library/postgres:17-bookworm и library/python:3.13-slim-bookworm вернули «not accessible via this tool». Никаких anonymous auth credentials не создавалось, registry CLI не выполнялся. Digest и architecture **не получены**. Не вставлять digest из документации/примеров/поиска и не подменять immutable pin tag-версией.

Проверяемый способ получения существует: registry metadata inspection `docker buildx imagetools inspect` показывает index digest и platform manifests, без pull image layers согласно [официальной документации Docker](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/). Доступность buildx/registry в Windows ещё неизвестна. Подтверждённый digest затем повторно inspect по immutable reference; отдельно reviewed index/platform choice и artifact pin. Registry metadata inspection не означает разрешение build/pull/containers.

## 4. Минимальные команды ручной проверки Windows

Ниже только read-only команды, здесь НЕ выполненные. PowerShell; не запускать build/up/run/exec/pull. Если CLI/plugin отсутствует или требуется login, остановиться. Credentials не создавать/не менять. Project/env/Compose указаны явно.

```powershell
$harnessPath = 'C:\Users\serge\cashback+\infra\finance-security-test'
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCommand) { throw 'Docker CLI unavailable' }
docker --version
docker compose version
if ($LASTEXITCODE -ne 0) { throw 'Compose unavailable' }
# Это template с placeholders/path examples, без настоящих credentials.
# Не использовать root .env или реальные secret env файлы для config preflight.
$configText = docker compose --project-name cashback-finance-security-9f --profile tools `
  --env-file "$harnessPath\compose.env.example" -f "$harnessPath\compose.yaml" config --format json
if ($LASTEXITCODE -ne 0) { throw 'Config validation failed; do not deploy' }
$config = ($configText -join "`n") | ConvertFrom-Json
if ($config.name -ne 'cashback-finance-security-9f') { throw 'Wrong project' }
foreach ($entry in $config.services.PSObject.Properties) {
  $service = $entry.Value
  if ($service.ports -or $service.privileged -or $service.network_mode) { throw 'Unsafe service' }
  foreach ($mount in $service.volumes) {
    if ($mount.type -ne 'volume' -or $mount.source -ne 'pgdata' -or
        $mount.target -ne '/var/lib/postgresql/data') { throw 'Unexpected data mount' }
  }
}
if ($config.networks.private.internal -ne $true -or $config.networks.private.external) {
  throw 'Unsafe network'
}
if ($config.volumes.pgdata.name -ne 'cashback-finance-security-9f_pgdata' -or
    $config.volumes.pgdata.external) { throw 'Unsafe volume' }
# Только несекретная краткая сводка, не весь rendered config/Env/secret paths:
[pscustomobject]@{Project=$config.name; Services=($config.services.PSObject.Properties.Name -join ','); Internal=$config.networks.private.internal}
```

Это минимальный structural check, не comprehensive schema/callgraph audit. Если Compose требует существующие secret paths или отклоняет placeholder image, сохранить nonsensitive error classification и STOP; не создавать файлы credentials ради validation. После подтверждения digest можно в process-only safe environment использовать настоящие PUBLIC image refs с external dummy paths, но без изменения repo/настоящих secrets; отдельная проверка конфигурации. `config` не начинает контейнеры и не подтверждает image availability.

```powershell
# Read-only engine/inventory; не публикует container environment.
docker info --format '{{.OSType}}/{{.Architecture}}'
docker ps -a --format '{{.ID}} | {{.Names}} | {{.Image}} | {{.Ports}}'
docker network ls
docker volume ls
# Registry metadata, no pull/build/creation; при auth/timeout остановиться.
docker buildx version
docker buildx imagetools inspect docker.io/library/postgres:17-bookworm
docker buildx imagetools inspect docker.io/library/python:3.13-slim-bookworm
```

Для registry evidence сохранить exact tag/time/index digest/platform digest и platform. Не учитывать unknown/unknown attestation manifests как runtime architecture. При ошибке ни один digest не считается подтверждённым. No builder create/bootstrap или login. Имена новых network/volume/project должны отсутствовать; existing same-name object не adopt. Полный docker inspect/Compose env не выводить: они могут раскрыть unrelated credentials. Допустима отдельная filtered inspection mounts/network IDs после выбора exact target без environment.

## 5. Что требует отдельного PostgreSQL-инстанса

Фактическая SQL validity, SECURITY DEFINER ownership/search_path/function permissions, SET ROLE denial, authenticated session_user context, missing/NULL fault rollback, generation +1/+2 и concurrency revoke/mixed isolation, CLOSED-by-default и cleanup success. pg_control_system privileges и transactional SET SESSION AUTHORIZATION fixture также требуют реального PostgreSQL17. Text/AST не доказывают это.

Instance creation/provisioning/bootstrap/SQL tests требуют отдельного разрешения и свежих credentials, distinct cluster/storage/network; ни existing main, ни historical finance DB не target. Полный grant/version/participant/reopen policy и real lot writers не реализованы synthetic harness. Operator test-only open не production controlled reopen. Успех этого harness не разрешает FinanceModule или real payments.

## 6. Критерии READY FOR ISOLATED TEST RUN

READY означает готовность запустить отдельно разрешённый synthetic эксперимент, НЕ что SQL/security уже доказаны.

1. Windows Docker/Compose availability и safe config validation подтверждены; engine Linux/platform выбрана.
2. Обе image refs разрешены через registry с доказанными immutable digests/architectures, reviewed pins применены отдельным разрешением; зависимости/platform compatible.
3. New project/network/volume names collision-free; new-instance creation manifest/procedure approved; отсутствие shared mounts/networks/credentials подтверждено.
4. External new secret paths/ACL и role separation reviewed; runtime suite не получает bootstrap, privileged fault tests fenced и отдельны.
5. Offline checks PASS, harness limitation/test-only open явно приняты; команды только exact project/file/env и без implicit app migrations.
6. Владелец отдельно разрешил создание isolated instance/resources/roles и SQL test execution; rollback/retention процедура согласована.

После первого запуска отдельная приёмка SQL/concurrency/CLOSED и manifest. До выполнения пунктов статус **NOT READY**. Read-only report не предоставляет разрешения создания ресурсов.

## 7. Контроль

Создан только новый work/finance-6v5-9H-harness-external-preflight.md. SHA-256 всех 247 baseline файлов совпали. Existing harness/src/DB/Docker/config/credentials/.gitignore сохранены. Status: известные ?? infra/, ?? src/finance/, ?? test/finance/; staging пуст. Whitespace check отчёта без ошибок. Нет commit/push/pull/fetch/SQL/container operations. Остановка после отчёта.
