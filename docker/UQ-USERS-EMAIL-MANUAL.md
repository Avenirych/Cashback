# UQ_users_email — историческая запись успешного применения

Миграция `AddUsersEmailUnique1791888000000` применена к основной тестовой БД
ровно один раз 13.10.2026. Это история завершённой операции, **не текущий runbook**.
Не применять и не откатывать миграцию повторно. Ни Docker, ни PostgreSQL при
актуализации документа не опрашивались; сведения ниже взяты из согласованных
предыдущих проверок и текущего кода.

## Подтверждённый результат

- Проект: `cashback-docker-test`; PostgreSQL 17.11, сервис `postgres-test`.
- База: `cashback_docker_test`; OID **16384**; роль `cashback_test`.
- PostgreSQL cluster ID: **7695793866029359141**.
- Проверенный PostgreSQL container ID:
  `02cabe6180fc651b16c87afc8dbd29b7209157d71d89545e51f6005c1f01aed4`.
- Volume: `cashback-docker-test_postgres-test-data`, `/var/lib/postgresql/data`.
- `UQ_users_email` существует, constraint validated; backing UNIQUE index valid/ready.
- История содержит шесть миграций; timestamp шестой: **1791888000000**.
- После последующих HTTP-проверок синтетический пользователь и письмо удалены.
  Все десять application tables пусты, Mailpit пуст. History сохранена.
  Users sequence не сбрасывалась; её увеличенное значение не означает наличие строк.

История по порядку:

1. InitialApplicationTables1733927999000
2. AddMarketingPreferences1733928000000
3. AddEmailVerification1735000000000
4. AddForumUsers1791394800000
5. CreateBonusTables1791630000000
6. AddUsersEmailUnique1791888000000

Backend впоследствии обновлён; его прежний container ID из pre-migration этапа
не является текущим. Перед будущими действиями получать полные актуальные IDs и
сверять их с последним согласованным отчётом; Compose labels недостаточно.
Последний отчёт описывает backend/PostgreSQL healthy, Mailpit/proxy запущенными
и frontend остановленным. Это не новая проверка текущего health.

## Что делали guard и preflight до применения

`src/docker-main-test-data-source.ts` не использует root dotenv, DATABASE_URL или
production DB_* fallback. Guard разрешал только основную тестовую БД, transaction
all и шесть зарегистрированных миграций. `assertMainDockerTestReadyForEmailUnique()`
в `src/docker-main-test-preflight.ts` проверял в read-only транзакции с timeout:
имя, роль, IP 172.18.0.2, порт 5432, cluster ID, PostgreSQL 17, OID 16384
(строго число либо decimal string), схемы, таблицы и пять точных history names.
Users должна была быть пуста, email — varchar NOT NULL без default, а UNIQUE(email)
отсутствовать. Проверялись backup, volume и остановка всех concurrent writers.

Этот guard предназначен **только для состояния до шестой миграции**. Теперь он
должен отклонять повторный запуск из-за шести history entries и существующего
UNIQUE. Нельзя менять guard ради повторного применения или использовать generic
CLI для обхода защиты. `synchronize=false` и `migrationsRun=false` сохранены;
AppModule не запускает миграции через DB_MIGRATIONS_RUN.

## Исторические команды — НЕ ВЫПОЛНЯТЬ повторно

Операция выполнялась из изолированного snapshot/CLI-runner, не через Nest startup.
Snapshot имел вложенную точку node_modules до read-only монтирования. Runner
использовал только database network и целевые переменные в памяти, без секретов
в командной строке или отчёте. Исторически сначала подтвердили единственную pending
миграцию, затем выполнили один вызов с transaction all:

```text
node node_modules/typeorm/cli-ts-node-commonjs.js migration:show -d src/docker-main-test-data-source.ts
node node_modules/typeorm/cli-ts-node-commonjs.js migration:run -d src/docker-main-test-data-source.ts --transaction all
```

Блок выше — архивная запись, не инструкция запуска. migration:show не следует
считать универсально read-only: на пустой БД TypeORM может создавать history.
Миграция up добавляет только `UQ_users_email UNIQUE(email)` на public.users,
не переписывает email. Down удаляет только это ограничение; его не выполняли
на основной БД и документ не разрешает откат. Preflight и DDL не составляли одну
транзакцию, поэтому остановка writers была обязательной. Автоматических повторов,
repair или ручного rollback после ошибки не допускали.

Read-only проверка после применения подтвердила identity, constraint/index,
шесть записей history, пустые users и отсутствие неожиданных изменений схемы.
Временный CLI-runner позднее штатно остановлен с exit code 0. Ошибку диагностического
сравнения timestamp (число/строка) исправили отдельно, без повторного применения.

## Сохранение данных и границы подтверждений

Проверенная копия находится в
`C:\Users\serge\Backups\Cashback-Docker20261013-115332-2d77bf55`:
`docker_data.vhdx`, `ext4.vhdx`, `backup-verification.json`.
Размеры/SHA-256 копий проверялись при остановленном Docker Desktop. Backup
предшествует последующим операциям и не является текущей логической копией БД.
Не сравнивать live VHDX с архивной копией как доказательство её актуальности.
Не удалять/перезаписывать backup, не заменять live VHDX и не выполнять автоматическое
восстановление. PostgreSQL logical restore и восстановление из VHDX не проверены.

Отдельная integration DB
`cashback_email_unique_it_a88eb0f355f948fadd76cebf0a4bc9`, OID **24577**, не является
основной БД. После отрицательного теста она может содержать синтетические дубликаты
и не иметь UQ_users_email. Не очищать, не удалять и не использовать её повторно
без отдельного разрешения. Существующие volumes должны быть сохранены.

UNIQUE проверяет точные сохранённые значения и чувствителен к регистру.
Канонизация JavaScript toLowerCase().trim() обеспечивается приложением; прямой SQL
может её обойти. SQL lower(btrim(email)) не является точной заменой. CHECK/citext
и автоматическое исправление email этой миграцией не вводились. Применение на
production, аудит её данных и проверка logical backup/restore требуют отдельного
плана; тестовое применение не является разрешением на production DDL.
