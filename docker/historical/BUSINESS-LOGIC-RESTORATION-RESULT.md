# Восстановление финансовой логики Cashback+

Дата: 20.10.2026. **BUSINESS_LOGIC_PARTIALLY_RESTORED**.

## 1. Фактический результат

Выполнена реализация в исходниках, а не только аудит:

* Возвращены 43 файла ранее разработанного финансового ядра в `src/finance`, включая FinanceModule, exact money, double-entry journal, внешний EntityManager, replay/conflict, outbox, restricted receipts, evidence/coverage/classification/correction review и миграции.
* Все 43 исходных файла побайтово совпадают с выбранной сохранённой копией. Добавлены отдельные файлы новых расчётных правил и read-only reconciliation; исходные файлы финансового ядра не переписывались.
* Восстановлены исторические защиты legacy Users/Topics/Posts в исходниках, добавлены regression tests.
* Реализованы независимо определённые **расчётные примитивы**, но не завершённый purchase/refund processor. Неизвестные условия возвращают blocked без движения денег.
* Backend TypeScript и build проходят; 244 выбранных backend/mock-теста проходят. Frontend TypeScript и production build проходят, но полный frontend Jest имеет 44 failed tests.

**FinanceModule НЕ подключён в AppModule. Нет новых финансовых HTTP endpoints, workers, реальных partner/bank authorities или автоматически запускаемых миграций. Активные контейнеры не перезапускались. Подготовленные security fixes также ещё не действуют в работающем образе.**

Это завершённый безопасный исходниковый этап A и часть независимо специфицированных расчётов B/C. Это не полное исполнение этапов B–E и не утверждение о работающих покупках/возвратах.

## 2. Источники и сохранность

Прочитаны BUSINESS_SPEC_6B_FINAL, архитектура 6В.3 и оба отчёта audit/history-recovery. Верхний статус FINAL-документа не принят за утверждение неизвестных условий. Новые подтверждения владельца A–F применены как актуальные требования: cashback только после действительного поступления, customer funds — обязательство, не доход; подтверждённые собственные денежные источники могут погашать долг при наличии средств.

Выбран исходный набор:

`C:\Users\serge\AppData\Local\Temp\cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15\project\src\finance`

Перед выбором сопоставлен с `work/finance-candidates-validation-a824ff6c83ef4f29b0717e547f154ce7/src/finance`. Отличия: README и два spec-файла. Backup содержит явные проверки наличия параметров mock query в bank-receipts/coverage tests; выбран этот типобезопасный вариант. Ассерты не удалены, strict types не ослаблены. Прежние TypeScript diagnostics validation snapshot не перенесены в рабочую копию.

[finance-restoration-provenance.json](finance-restoration-provenance.json) содержит источник, все 43 относительных пути и SHA-256 оригинала/восстановленного файла. Для каждого они совпали. Дополнительные policy/reconciliation файлы перечислены отдельно ниже и не выдаются за исторические.

Три заменённых файла предварительно скопированы с проверкой SHA-256 в:

`work/business-restoration-fdedbde6ba69473c9b6b84f86a318ee8/src/`

Архив содержит прежние `users/users.controller.ts`, `topics.controller.ts`, `posts.controller.ts`. До переноса `src/finance` отсутствовал; существующий финансовый каталог не перезаписывался. Recovery worktree/старые snapshots сохранены. Git HEAD остаётся `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`; reset/checkout/clean/commit не выполнялись.

## 3. Сохранённые финансовые правила

* Cashback/rewarded advertising: 80% customer / 20% platform; research referral 50/50; passive advertising 0/100. База — проверенный соответствующий доход, не цена товара.
* GBP — bigint pence, HALF_UP, platform получает точный остаток после округления customer share. Никакого float-пересчёта balances.
* Confirmation без фактического received payment не разрешает available cashback.
* Received total, customer liability, platform share, expenses и platform net income возвращаются отдельными суммами. Customer liability не включена в platform net income.
* Для нового распределения нужны положительная чистая маржа, известные costs, отдельное покрытие customer amounts/fees и budget gate. Неизвестные costs не равны нулю. Внутренняя функция не удостоверяет достоверность этих фактов.
* Debt collection ограничена outstanding amount и реально доступной частью подтверждённого источника. Не затрагивает unrelated owner, pending и protected reservation. Очередность источников должна приходить из утверждённой policy, а не назначается скрытым сортировщиком.
* Подтверждённые реальные GBP не получают demo expiry. Текущий demo BonusModule не менялся и не импортировался в новый financial ledger.

## 4. Новые независимо определённые операции

`src/finance/business-policy.ts` — **внутренний planner**, без decorators, controllers, DB writes или автоматического вызова:

| Функция | Что реализовано | Граница |
|---|---|---|
| `planRevenue` | Confirmation+exact assigned receipt required; split; customer liability/expenses/platform net отдельно; unknown costs/nonpositive margin/coverage/budget fail closed | Не подтверждает банк/продавца. При partial/over receipt блокирует, не выдумывает пропорциональное settlement |
| `planDebtCollection` | Разбивка подтверждённого долга по нескольким собственным доступным источникам, cap debt/funds, duplicate source refusal | Не исполняет взыскание. Нет multi-debt priority, чужой linked-lot collection или уменьшения собственного резерва с пересчётом order quote |
| `selectBonusOrder` | Один highest eligible candidate после достоверной утверждённой metric/finality, duplicate rejection | Нет утверждённой policy или есть tie — blocked. Не определяет reporting deadline, не делает reservation/allocation |
| `unresolvedAdjustment` | Явный blocked для full/partial refund/cancellation, нулевое движение | Не сохраняет refund request в БД и не подменяет готовый handler |

`src/finance/reconciliation.ts`: read-only сверка полного committed journal history с cached balances нулевых изначально finance accounts; проверка balanced journals, дублированных postings, неизвестных accounts, negative availability. Возвращает расхождения, не исправляет историю. Вызывающий код обязан читать одну согласованную DB snapshot; bank backing/evidence и полноту переданного набора эта функция не удостоверяет.

Эти примитивы специально **не являются авторизацией**. Boolean confirmed/coverage input из публичного запроса нельзя использовать как доказательство. Будущий orchestrator должен получить факты через доверенные authority и выполнить state change + ledger + outbox в одной locked transaction. Сейчас такого production orchestrator нет; функциям не добавлены публичные routes.

## 5. Security fixes — подготовлены, не deployed

Исторический источник: Git `92c8532`.

* `src/users/users.controller.ts`: больше нет public list/create/balance handlers. Оставшиеся GET/PATCH собственного пользователя защищены JwtAuthGuard, integer ID и проверкой req.user.id === requestedId.
* `src/users/users.dto.ts`: явная безопасная сериализация без password/email token; PATCH allowlist только исторического trimmed name, без balance/email_verified/password/phone mass assignment.
* `src/topics.controller.ts`, `src/posts.controller.ts`: сняты HTTP method decorators старой параллельной доски. Данные не удалены, сервисы не переписаны, современный `/forum/*` не изменён.
* `src/users/restored-security.spec.ts`: anonymous/cross-user denial before service calls, guard metadata, sensitive-field omission, mass-assignment rejection и отсутствие legacy HTTP handlers.

Активный образ сохраняет прежний код до отдельно проверенного deployment. Поэтому обнаруженные audit vulnerabilities **нельзя считать закрытыми на localhost:3006**. Для проверки полного live JWT ownership/HTTP поведения нужны отдельные runtime checks после безопасного release; metadata/unit tests их не заменяют.

## 6. Изменённые/добавленные файлы

Полный исторический список 43 файлов: [provenance manifest](finance-restoration-provenance.json).

Дополнительно:

* `src/finance/business-policy.ts`, `business-policy.spec.ts`.
* `src/finance/reconciliation.ts`, `reconciliation.spec.ts`.
* `src/users/users.controller.ts`, `users.dto.ts`, `restored-security.spec.ts`.
* `src/topics.controller.ts`, `src/posts.controller.ts`.
* `docker/historical/finance-offline-process-guard.cjs`, `jest.finance-offline.json`, `finance-restoration-provenance.json`, этот отчёт.

Build outputs созданы только локально (`dist`, frontend `build`); это не deployment. Frontend source, AppModule, production configuration, auth/email/phone/profile/forum/marketing/ads/Wise logic не редактировались.

## 7. База и миграции

Повторная независимая read-only проверка выполнена сейчас, а не только по старому отчёту:

* Docker context `desktop-linux`.
* Container `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`, running, project `cashback-historical-03573b7-local`.
* Volume `cashback-historical-03573b7-local-pgdata`.
* Cluster **7698666936429441062**; database **cashback_historical_03573b7**, OID **16384**.
* Runtime role **cashback_hist_runtime**, no SUPERUSER/CREATEDB/CREATEROLE.
* Дополнительно проверена реальная read-only connectivity из существующего backend контейнера с его runtime-role/credentials. Credentials не выводились. `SELECT current_database(),current_user,oid` подтвердил ожидаемые database/role/OID; transaction READ ONLY завершена.
* В public по-прежнему 11 historical tables; finance_* tables отсутствуют. Существующие пользовательские записи/балансы не менялись.

### Восстановленный migration inventory (НЕ applied)

| Миграция | Назначение / ограничение |
|---|---|
| 1791890000000 CreateFinanceCore | accounts/journals/postings и triggers; есть destructive down — не использовать как recovery финансовой истории |
| 1791891000000 AddFinanceOutbox | outbox; down также удаляет объекты |
| 1791892000000 AddBankReceipts | restricted receipts/funding lots; down удаляет объекты |
| 1791893000000 AddEvidenceControl | bank operation/observation/decision/restore review/evidence events |
| 1791894000000 AddSyntheticCoverage | **test-stage synthetic coverage**; не допущена к active database |
| 1791895000000 AddReceiptClassification | immutable classifications/parts/correction requests |
| 1791895100000 FixClassificationCompleteness | отдельное trigger correction, не переписывает прошлую migration history |
| 1791896000000 AddCorrectionReview | review decisions, не monetary application |
| 1791897000000 AddCorrectionCandidates | exact candidates/cross-request invariants, не monetary application |

Проверены состав, декларации, связь с сервисами/tests и отсутствие подключения к application DataSource; **production security/schema compatibility approval не выдана**. Core SQL использует неквалифицированные имена, поздние файлы — public: требуется reviewed trusted search_path/schema policy. Default-deny authorities сохранены. Не следует автоматически регистрировать весь набор, особенно synthetic coverage.

Applied migrations: **0**. synchronize/migrationsRun не включались. Новые схемы purchase/order/reservation/lot lineage/obligation/refund не создавались: безопасный migration set зависит от отсутствующих domain policies и доверенных adapters.

Новая active database backup/trial restore не выполнялась: никаких active DB modifications нет, до этой границы не дошли. Существующая source backup не выдаётся за проверенный restorable DB backup. До любого применения нужны свежий backup, разрешённый isolated trial restore, роли/grants review и isolated PostgreSQL tests.

## 8. Проверки

| Проверка | Результат |
|---|---|
| Full backend TypeScript `tsc -p tsconfig.json --noEmit --incremental false` | PASS, включая восстановленные specs |
| Backend build `tsc -p tsconfig.build.json --incremental false` | PASS |
| Guarded backend finance/security + email/extended-registration/demo-bonus/marketing offline suites | **16 suites / 244 tests PASS** |
| Frontend TypeScript noEmit | PASS |
| Frontend production build через react-scripts build | PASS with warnings: Register no-control-regex; emailValidator no-useless-escape; не исправлялись как посторонний scope |
| Full frontend Jest | **12 suites PASS / 3 FAIL; 162 tests PASS / 44 FAIL** |
| Node syntax guard | PASS |
| `git diff --check` | PASS с обычной конфигурацией Git |
| Real PostgreSQL domain/concurrency tests | NOT RUN: нет проверенного выделенного test target/завершённого domain schema и trial restore |
| Live purchase/refund/real transfers | NOT RUN, не разрешены как реальные операции |

Backend команда:

```text
node -r ./docker/historical/finance-offline-process-guard.cjs ./node_modules/jest/bin/jest.js --config docker/historical/jest.finance-offline.json --runInBand --no-cache --silent
```

Guard запрещает реальные child-process APIs, TCP connections и fetch. Backend tests не открывали HTTP/DB sockets. Первый frontend запуск с preload guard остановился **до тестов** на capability probe старого Jest (`node --eval import("node:fs")`); это не PowerShell/security diagnostic. Окончательный frontend запуск использовал guard через setupFiles до тестовых модулей, после инициализации runner. Guard не отключался для тестового кода. Первый дополнительный backend вызов имел неподходящий testMatch и не нашёл tests; config исправлен, окончательный полный выбранный набор дал 244 PASS, `passWithNoTests` не применялся.

Неуспешные frontend suites (frontend source не менялся):

* `src/App.test.tsx`: ожидает стартовую CRA-ссылку `learn react`, которой нет в приложении.
* `src/pages/RegistrationOnboarding.test.tsx`: ожидает прежнее поле `Name`, несовместимое с текущей расширенной регистрацией.
* `src/onboarding.test.tsx`: утверждения о disabled enrollment при пустых/частичных/неверных реквизитах расходятся с текущим поведением.

Полный machine-readable frontend result и logs сохранены в `work/business-restoration-fdedbde6ba69473c9b6b84f86a318ee8/`. Эти failures не скрыты выборочным PASS и не исправлены удалением проверок. Отсутствие всех регрессий не заявляется.

## 9. Purchase-to-cashback: готовность по шагам

| Шаг | Готовность |
|---|---|
| Buyer → trusted partner offer/click | Нет production partner authority/offer snapshot/click domain |
| Atomic reservation before redirect | Не реализовано; pure order selection не является reservation |
| One click → multiple orders | Известное правило; нет persistent trusted order/event model |
| Partner confirmation | Само по себе никогда не разрешает available cashback |
| Actual merchant payment | Восстановлен restricted receipt core, но live verifier default deny |
| Financial allocation | Exact split и fail-closed planning есть; orchestration/posting to liability/fees/platform не подключены |
| Available cashback/history | Generic ledger/read-only reconciliation есть; полноценный own-user read model/financial history endpoint не добавлен |

Реальные средства и demo credits не смешаны. Нельзя передать `confirmed:true` из browser и считать receipt доказанным. Не создан fake partner integration или simulated money receipt.

## 10. Возвраты, lineage и долги

Готова плановая разбивка долга по нескольким подтверждённым собственным свободным monetary sources в пределах actual funds. Защищённые резервы исключены, пока нет механизма атомарного пересчёта заказа/освобождения. Это намеренное безопасное ограничение, а не изменение правила о допустимом взыскании из резерва самого должника.

Полные/частичные refund/cancel остаются blocked. Нет guessed deadline, пропорциональной формулы, liability basis или finality. Не создаётся ложный zero-debt/write-off, не возвращаются автоматически applied bonuses в available. Не взыскиваются unrelated recipient funds, не меняются старые journal entries.

Не реализованы ещё: provenance lots/slices через переводы, capped linked recovery у получателя, full obligation/reversal orchestration, multi-debt priority и idempotent domain callbacks. Восстановленные correction review/candidate metadata не выдаются за выполнение денежного возврата.

## 11. Deployment и rollback

**Live deployment НЕ выполнен.** Frontend `http://localhost:3004/`, backend `http://127.0.0.1:3006/` оставлены на существующих образах. PostgreSQL/Mailpit и прочие контейнеры не перезапускались; SQL writes/GRANT/migrations/внешних платежей не было. Source security fixes готовы, но live vulnerabilities ещё требуют безопасного release.

Rollback текущих source changes: взять три прежних controllers из проверенного source archive; новые finance/DTO/tests/configs при необходимости архивировать отдельно, не удалять без review. Ни database down, ни изменение финансовой истории не требуются, поскольку миграций/денежных операций не было. Автоматический destructive rollback не подготовлен.

## 12. Точные оставшиеся решения и работы

1. Утверждённые A–E больше не считаются неизвестными: receipt-only availability, liability ownership, source split и own confirmed monetary debt sources отражены в коде. Они не разрешают неизвестные Q13/Q08 автоматически.
2. Для highest-order allocation нужны finality/metric, ties, late higher/cancelled winner, price changes, excess release и partial-return reassignment. Сейчас такие случаи blocked.
3. Для refund application нужны точный verified merchant obligation, full/partial basis, fee/platform liability, после payout и порядок slices/долгов. Не задаётся новая дата возврата или процент.
4. Нужны реальные trusted partner/bank authorization contracts, chart of accounts с отдельными bank/transfer expense и liability/reserve/platform accounts, persistent order/lot/debt orchestration в общей transaction.
5. Нужны отдельно подготовленный isolated PostgreSQL test target, trial restore и полный migration/privilege review; production synthetic authorities использовать нельзя.
6. Неуспешные frontend tests требуют отдельной согласованной корректировки ожиданий/дефектов без ослабления пользовательских правил, затем regression pass.
7. Только после этих работ — complete isolated PostgreSQL concurrency/rollback/reconciliation suite, safe deployment package и non-destructive runtime verification. До этого нельзя считать business workflow восстановленным или включать реальные финансовые операции.

**Итог: BUSINESS_LOGIC_PARTIALLY_RESTORED.** Реальный source implementation выполнен и протестирован в указанной границе; незавершённая покупка/refund processing честно остаётся выключенной.
