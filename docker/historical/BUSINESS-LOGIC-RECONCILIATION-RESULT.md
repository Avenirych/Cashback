# Согласование финансовой логики с решениями владельца

20.10.2026. **BUSINESS_LOGIC_RECONCILIATION_PARTIAL**.

## 1. Реализовано в этом задании

* Исправлен пропуск refund/finality gate в новом `planRevenue`: фактически полученный доход всё равно не допускается к плану распределения при pending/unknown finality. Нет придуманного окна возврата.
* Banking fees, transfer expenses и other costs выделены отдельно; их сумма должна совпадать с total costs. Customer liability не считается platform income. Неизвестный/несогласованный breakdown блокирует план.
* Реализован внутренний транзакционный слой **purchase evidence linkage**: стабильный click связан с buyer/partner/offer; несколько partner orders могут относиться к одному click. Повторы не дублируют связь, конфликт buyer/partner/offer отклоняется. Все orders остаются `pending_review`, денег эта операция не создаёт.
* Подготовлена отдельная additive migration для immutable linkage. Она проверена только в новом disposable PostgreSQL. Ни AppModule, ни активная схема не менялись.
* Исправлены все 44 frontend test failures без изменения производственного frontend-кода. Сохранены проверки invalid credentials/owner, storage failures, account switching, email verification и защищённого участия; устаревшая блокировка публичного просмотра заменена проверками фактических целевых действий.
* Проведены настоящие PostgreSQL core/linkage integration checks, включая competing debit concurrency; отдельно — HTTP JWT/ownership tests в изолированном mock Nest module.
* Подготовлен отдельный security-only patch и release manifest. Ничего не deployed.

Это source implementation и проверка конкретных частей, **не завершённый денежный purchase/refund workflow**. Domain orchestration, reservation/lineage/debt/refund application и подтверждённые внешние integrations ещё отсутствуют.

## 2. Приоритет источников и хронология

| Источник / дата | Правило / разрешённый приоритет | Применение |
|---|---|---|
| Последнее явное задание владельца, 20.10.2026, attachment `413d85fc-f3cc-45be-9d24-4d7cf7db002d` | Receipt **и применимые refund/finality conditions**; customer money — liability; separate expenses; all eligible own confirmed monetary debt sources | Добавлен fail-closed finality gate и expense reconciliation; debt planner остаётся generic по всем собственным подходящим источникам, не только cashback |
| Предыдущее явное задание, 20.10.2026, attachment `a7925505-1eaf-4680-957a-e60dbf4a7d10` | Confirmation alone не делает cashback available; actual merchant receipt обязателен; не изобретать refund правила | Сохранено; receipt сам по себе также не заменяет finality согласно последнему уточнению |
| BUSINESS_SPEC_6B_FINAL B01–B06 и B61–B66 | 80/20, 80/20, 50/50, 0/100; GBP integer pence/HALF_UP; platform remainder; positive margin/cost/coverage/budget gates | Exact money core сохранён; expenses не уменьшают promised customer share. Новое задание не отменяло эти ранее помеченные утверждёнными gates |
| BUSINESS_SPEC §13 B45–B51, дополнение 14.10.2026 | One click → many eligible orders; бонус применяется один раз к highest eligible order | Implemented evidence linkage; bonus winner planning не назначает metric/tie/finality самостоятельно |
| BUSINESS_SPEC §14 B52–B58, дополнение 14.10.2026 | Подтверждённые реальные GBP не сгорают; original confirmation age сохраняется | Finance core не вводит expiry. Старый expiring browser/forum **demo** не превращён в реальный ledger |
| BUSINESS_SPEC B54/B64–B65 (последующие дополнения) | £10 trigger дополнен шестимесячным trigger ниже £10, общими fee/coverage/no-debt/provider gates | Старое «только £10» не является полной текущей policy. Автоматические выплаты не реализованы; точные calendar details Q14 не назначены |
| `179bba6`, 06.10.2026 → historical baseline `03573b7…`, 10.10.2026 и последующие owner instructions сохранить public navigation | Ранняя Welcome/page gate заменена открытым просмотром `/shop` и `/bonuses*`; participation остаётся защищённым | Старые тесты против public pages обновлены; production routes/guards не изменялись |

Даты поздних B64–B66 не придумываются: в доступном файле есть последовательность дополнений, но нет отдельной проверенной даты каждого. Они рассматриваются как исторические записи approved amendments, а не как автоматическое утверждение всего FINAL-документа. Черновые lot-version/cutover proposals не получили production authority от своего более позднего имени.

Дополнительно проверены доступные `work/finance-6v5-*` design/readiness records. В частности, `finance-6v5-9B-readiness-audit.md` прямо имеет статус «АУДИТ И ПЛАН; внедрение не начато» и не задаёт отсутствующие monetary/refund решения. Дополнительного полного conversation export с точными deadlines/partial refund/tie rules в исследованных материалах не найдено. Не заявляется доступ к неизвестным внешним чатам.

## 3. Исправленные конфликты

1. **Receipt-only planning → receipt + finality.** Предыдущая функция могла вернуть ready при actual receipt, не проверяя применимые finality conditions. Теперь `RevenueFacts.finality` обязателен, а runtime missing/unknown/pending не допускаются. Это исправление source planner; live начисления до него не выполнялись.
2. **Aggregate expenses → отдельный breakdown.** Total costs остался проверяемым итогом; banking/transfer/other не объединены с customer obligation. Нулевые расходы допустимы только как явно заданные verified values, а missing breakdown блокирует.
3. **Старое истечение → non-expiry реальных средств.** Не импортируется expiry demo BonusItem в новый finance design. Полноценный real lot/age mechanism ещё не создан.
4. **Только £10 → £10 плюс позднее исключение и единый payout gate.** Старый manual withdrawal branch не подключается как готовый актуальный payout processor.
5. **Закрытый просмотр бонусов → public browse / protected participation.** Исправлены тесты, а не ослаблены guards. Подтверждение email и onboarding по-прежнему обязательны в BonusGuard и при запуске защищённых действий.
6. **Metadata correction approved → НЕ financial correction applied.** `applicationImplemented:false` в исторических correction services сохранён; approval нельзя использовать как доказательство выполненного refund.

## 4. Код и сохранность

Перед изменением пяти существующих файлов создана SHA-256-проверенная копия:

`work/business-reconciliation-2abd7aa84ab24428968b82d004e9050d/`

Изменены:

* `src/finance/business-policy.ts`, `business-policy.spec.ts` — finality и expense breakdown, regression cases.
* `cashback-frontend/src/onboarding.test.tsx`, `App.test.tsx`, `pages/RegistrationOnboarding.test.tsx` — корректные тесты текущих подтверждённых UI/auth contracts.

Добавлены:

* `src/finance/purchase-linkage.ts`, `purchase-linkage.spec.ts`.
* `src/finance/migrations/1792500000000-AddPurchaseLinkage.ts`.
* `docker/historical/finance-disposable-postgres.cjs` — opt-in реальный disposable test runner.
* `docker/historical/legacy-security-http.cjs` — explicit loopback HTTP test runner с mock repositories.
* [legacy-security.patch](legacy-security.patch), [legacy-security-release.json](legacy-security-release.json).
* Этот отчёт; test results/logs в указанном work-каталоге.

43 исторических finance-файла и их provenance manifest не перезаписывались. Активная конфигурация, AppModule, registration/email/phone/forum/marketing/Wise/ads production code не менялись. Git baseline не менялся, существующее uncommitted work сохранено.

## 5. Новая purchase linkage: граница и гарантии

`PurchaseLinkageService` принимает только активный caller-owned EntityManager той же DataSource. Нельзя передать чужой/inactive manager или создать вложенную independent transaction. Production default authority **deny**. Публичный запрос не становится доверенным от наличия principal/proof ID: adapter обязан проверить реального actor/ownership/source. Такой live adapter здесь не добавлен.

Clicks сохраняют immutable buyer/partner/offer и material hash. Orders имеют canonical `(sourceNamespace, orderId)`, FK на click. Повтор — тот же record; rebind к чужому click/owner отклоняется. Один click допускает несколько order IDs. SQL locks/unique constraints и outer transaction защищают записи; откат не оставляет новое evidence. Нельзя переводить state в `available`: единственный разрешённый state — `pending_review`.

**Это не reserve, не seller redirect и не order confirmation/payment endpoint.** Не добавлены суммы/commission из browser, не придуман callback protocol. Нужны verified partner adapter и следующие отдельно проверенные domain operations для превращения этих evidence records в реальные покупки.

## 6. Refund/reservation matrix

| Сценарий | Подтверждённое правило | Исполнение сейчас |
|---|---|---|
| Seller redirect | Atomic reserve before redirect, без двойного использования | Не реализовано: нет real lots/lineage/reservation transaction; операции денег выключены |
| Buyer changes purchase | Atomic transfer of same reservation, сохранение происхождения/условий | Не реализовано; не освобождать и не резервировать двумя independent commits |
| Purchase conclusively fails | Освободить unused reservation на доказанном основании | Нет persisted reservation/verified failure adapter. Не заменяется произвольным TTL |
| One click/multiple orders | Cashback на все eligible confirmed **received** orders; bonus на один winner | Evidence linkage есть; monetary allocation выключена |
| Highest order / excess | Не списывать excess, один winner | Planner поддерживает известный unique highest при approved metric/finality; tie/late/cancelled winner/partial-return reranking blocked |
| Confirmation без денег | Не available | Unit regression PASS |
| Receipt при pending/unknown finality | Не available | Новый regression PASS |
| Full refund | Linked correction, immutable history, capped verified obligation; debt возможен и после payout | Денежный handler не реализован; liability basis/fees/platform component должны быть определены |
| Partial refund | Точная утверждённая база и формула, без двойной коррекции | Точной формулы/срока не найдено; blocked без денег |
| Own confirmed receipts → debt | Все подходящие свои денежные источники, cap debt/available funds | Планировщик есть; transactional collector/очередность нескольких obligations пока отсутствуют |
| Transferred bonus | Исходный должник отвечает, unrelated recipients защищены; linked free amount допускается к cap recovery по правилам | Persistent lineage/collector ещё нет. Чужой owner не списывается generic debt planner |
| Recipient reserved/spent funds | Protected; после release без использования проверить permitted linked offset | Не реализовано как domain transaction, не имитируется тестовым boolean authority |
| Duplicate/late callbacks | Canonical identity, replay/conflict; late не даёт второй allocation | Linkage replay/constraints PASS; полная lifecycle/callback orchestration отсутствует |

Проверки неизвестных сценариев не заменены догадками о сроках, proportional refund, winner tie или размере долга.

## 7. Accounting/reconciliation

Точное split/conservation, immutable journals, transaction manager/outbox, negative-balance rejection и read-only cached-balance reconciliation сохранены. Новый expense breakdown отделяет liabilities от net result на уровне planner. Нет заявления, что активный UI уже показывает реальные счета или что customer obligations автоматически зарезервированы исполненным settlement.

Покрытие bank facts остаётся отдельной trusted границей: receipt UUID/hash не доказывает действительное поступление. Production evidence/coverage/classification authorities остаются default deny. Synthetic test authorities не активированы. Actual bank vs liability reconciliation, полномасштабный chart of accounts с expenses и полный reservation/debt conservation ещё требуют реализации.

## 8. Security release отдельно от finance

Подготовленные ранее owner-only Users handlers, safe DTO/allowlist и снятые legacy Topics/Posts method decorators сохранены. Новых financial HTTP routes нет.

Новый HTTP runner импортирует **только** нужные compiled controllers/strategy, не AppModule. Nest module использует mock repositories/services, synthetic JWT secret только внутри test process, binding `127.0.0.1` на автоматически выделенный порт. Проверено **12 HTTP cases**: anonymous/invalid JWT/cross-owner denial, собственный safe response без hashes/tokens, mass assignment 400, allowlisted own patch, отсутствие list/create/balance/legacy topics/posts routes. После проверки сервер закрыт.

Security-only patch содержит 4 исходных файла, не FinanceModule/migrations. `git apply --check` выполнен на scratch-копии historical baseline (LF). Patch уже отражён в текущем worktree; его нельзя повторно применять вслепую. Перед release нужен проверенный target hash/encoding, build и тот же набор tests. [Manifest](legacy-security-release.json) явно требует owner approval для restart. Source package независим от финансовых migrations, но **в активных контейнерах защиты ещё не deployed**.

## 9. Frontend: 44 failures и исправления

Исходный запуск: **162 PASS / 44 FAIL**, 3 failed suites. Финальный полный запуск: **208 PASS / 0 FAIL**, 15 suites PASS. Дополнительно сохранена отдельная UI-проверка ошибок сохранения/участия в Profile и повторного успешного действия после storage failure.

Причины:

* `App.test.tsx` (1 failure): устаревшая стартовая CRA-проверка `learn react`. Заменена проверками настоящих public navigation и privacy/FAQ links.
* `RegistrationOnboarding.test.tsx` (1 failure): устаревшие `Name`, слабый пароль и ожидание немедленного persistent verified session/Welcome. Теперь используются действующие first/last/phone/password/terms; проверены pending token в sessionStorage, отсутствие persistent token, verification UI и отсутствие program enrollment.
* `onboarding.test.tsx` (42 failures): смесь ранних public-page gating assertions, mock account без `email_verified` и прежних expectations редиректов. Переделаны тесты на действующие public routes, реальные production `useOnboarding`/helpers/Profile и BonusGuard protected participation. Guest/invalid owner/unverified/ineligible по-прежнему не могут участвовать; corruption/storage rollback/account switching cases сохранены. Это коррекция устаревших assertions/fixtures, не изменение production правил ради green.

Frontend production-код не менялся; действительный UI regression этими 44 случаями не доказан. Иных исправлений frontend behavior не заявляется. Ниже приведены все исходные 44 failed test names с классификацией, а не только пример одного failure.

## 10. Проверки и database safety

* Backend mock/unit: **17 suites / 251 tests PASS**.
* Backend full TypeScript noEmit и production TypeScript build: **PASS**.
* Frontend TypeScript: **PASS**; production build **PASS с прежними lint warnings** (Register control-character regex, emailValidator unnecessary escapes).
* Frontend full Jest: **15 suites / 208 tests PASS**. Guard загружается до test modules; runner capability probe старого Jest не интерпретируется как financial/PowerShell diagnostic.
* Security HTTP: **12 checks PASS**, mock Nest loopback, без active backend/DB.
* Реальный PostgreSQL: **14 groups PASS** в новом disposable cluster, включая core SQL invariants, конкурирующее списание (только один commit), rollback, immutable journal/cache, duplicate event, read-only-role denial, one-click/many-orders linkage, uniqueness/FK/state guards/immutable evidence/rollback.

Финальный test cluster **7698795739121025063**, database `finance_reconciliation_test`, container `eae4eedc794aa5b7914817b428cbd76c18f2eb28364426eb383d5ef021c452cb` — **удалён после проверок**. Runner применял только restored core migration и новую linkage migration к независимо проверенной пустой public schema. Это не active historical database и не испытание всех девяти исторических migrations.

Контейнер: pinned имеющийся PostgreSQL image, `--network none`, без host ports и persistent volumes, data directory в tmpfs. Проверены exact ID/name/label/image/mounts. Существующие container IDs, network и volume inventories совпали до/после. Credentials сгенерированы только для disposable test, не записывались/не выводились. Cleanup касается только exact labelled test container, не использует prune/down/volume removal.

Первый тестовый запуск обнаружил readiness race: `pg_isready` видел временный init-server. Этот контейнер безопасно удалён, runner исправлен — теперь ждёт final PostgreSQL PID 1. Повторные core и расширенные linkage проверки прошли; начальный failure сохранён в `postgres-initial-readiness.json`, не скрыт. При разработке HTTP runner исправлена синтаксическая ошибка до успешного запуска. Все финальные результаты/logs находятся в `work/business-reconciliation-2abd7aa84ab24428968b82d004e9050d/`.

**Active database modifications: 0.** Новая migration applied только к disposable test DB. Historical PostgreSQL, user balances, forum и marketing records не менялись. Новая active DB backup/trial restore не выполнялась, поэтому production migration gate остаётся закрыт. PostgreSQL tests — прямые SQL/constraints; полный TypeScript service→реальная DB workflow и trusted live authorization не сертифицированы этими 14 группами.

## 11. Deployment

**Никаких active container restarts/deployments не было.** FinanceModule не подключён к AppModule; новая linkage service не зарегистрирована в активном приложении. Customer purchases/refunds/reservations/debt application не активны.

Адреса существующего сайта остаются `http://localhost:3004/` и `http://127.0.0.1:3006/`; работа нового финансового процесса на них не заявляется. Prepared security source package также требует отдельного разрешения на безопасный release/restart.

## 12. Оставшиеся препятствия и решения

**Уже не неизвестны:** receipt-only availability с finality gate, customer liabilities, expense separation, четыре split ratios, all eligible confirmed own monetary debt sources, one-click/multiple-order linkage.

**Нужны точные approved details:** partner-specific finality/reporting windows и допустимый trusted event; winner metric/ties/late higher order/cancelled winner/excess release; full/partial refund obligation basis, fees/platform liability/after-payout handling; конкретная formula partial refund; очередность нескольких debts/slices и допустимое уменьшение собственного purchase reserve; calendar ageing specifics Q14. Не назначаются новые сроки/проценты/долги.

**Нужна реализация, а не только решение:** real partner/bank authority, immutable lot lineage, atomic reserve/move/release, order state machine, receipt-backed settlement, liability/expense postings и user history API, capped transactional debt/refund collector, reconciliation по всем domain totals. Linkage и planners не заменяют эти операции.

Перед включением денег необходимы полный service→isolated PostgreSQL E2E/concurrency suite, least-privilege boundary, restorable active DB backup+trial restore, review migration package и owner approval. Security-only release можно рассматривать отдельно по подготовленному пакету; он не запускает финансовую систему.

**BUSINESS_LOGIC_RECONCILIATION_PARTIAL** — фактические исправления и новые операции выполнены в описанной границе, но полного проверенного purchase/refund исполнения нет.

## Приложение: классификация всех исходных frontend failures

| Исходный failed test | Классификация / коррекция |
|---|---|
| empty credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| partial credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid email credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid currency credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid account type credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| non-string field credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| missing saved marker credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid saved marker credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| corrupt JSON credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| array credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| other owner credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| no owner credentials fail closed despite an old enrollment | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity undefined cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity null cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity 0 cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity -1 cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity NaN cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity Infinity cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity 1.5 cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid user identity "101" cannot save or access bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| unsaved typing, save and explicit enrollment update Welcome immediately | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| localized en explanation has a working profile link | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| localized ru explanation has a working profile link | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| localized de explanation has a working profile link | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| localized fr explanation has a working profile link | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses redirects ineligible users before rendering bonus content | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses/ads redirects ineligible users before rendering bonus content | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses/research redirects ineligible users before rendering bonus content | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses preserves guest registration onboarding | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses/ads preserves guest registration onboarding | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| direct /bonuses/research preserves guest registration onboarding | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| alternate link cannot bypass the gate; shop remains accessible | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| button handler rechecks storage even before a storage event updates the UI | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| invalid old enrollment leaves form editable and requires fresh enrollment after repair | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| corrupt enrollment can be repaired by saving credentials and explicitly enrolling | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| account switch, logout and return never inherit eligibility | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| relevant storage changes revoke bonus route access and update the form | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| storage clearing and enrollment changes update already mounted Welcome | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| read failures and save/enrollment write failures fail closed and are recoverable | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| partial enrollment write rolls back and does not survive refresh | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| loading session does not prematurely redirect or allow bonuses | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| guests keep the enabled registration button | Устаревшая public-page gate / fixture; сохранены protected-action/helper checks |
| renders learn react link | Устаревший CRA assertion |
| registration with accepted terms creates a session, not program enrollment | Устаревшие поля/session expectations |
