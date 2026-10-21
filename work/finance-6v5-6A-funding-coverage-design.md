# Cashback+ — 6В.5.6-А: funding lots и транзакционное покрытие

Дата: 14.10.2026. **ПРОЕКТ НА УТВЕРЖДЕНИЕ. Только проектирование.**
Документ не разрешает начисления, разблокировку funds, миграции или банковские операции.

## 1. Источники, приоритет и текущее состояние

Изучены BUSINESS_SPEC_6B_FINAL.md (включая B61–B65), проекты 3A, 3B, 3B1,
6В.5.5 и 6В.5.5-А; текущие receipts, evidence, ledger и outbox в src/finance/.
Утверждение владельца 6В.5.5-Б имеет приоритет над предварительными вариантами
проектов: неоднозначный observation идёт в карантин, но не блокирует весь счёт;
отзыв блокирует каноническую operation независимо от другого evidence;
восстановление требует независимого reviewer и controller; отозванный receipt
не возвращается как успешная новая регистрация. Существующие документы не исправляются.

Фактически реализованы:

- Positive GBP receipt: Dr company_bank_cash / Cr unallocated_received_funds.
  Один receipt — один immutable funding lot той же суммы со status=restricted.
- EvidenceService.verifyWithManager/bindReceiptWithManager; каноническая operation,
  observations и decisions, documented revoke/recheck/restore, immutable audit.
- Source/native observation → canonical operation через независимо проверенные decisions.
  UUID/hash/роль из запроса не являются доказательством банковского факта или полномочий.
- assertLotEvidenceWithManager возвращает restricted:true: это guard доверия,
  **не разрешение использования, не проверка остатка или назначения**.
- Lock order: authorization (726405,0), account scope (726404), bank identity (726403),
  operation rows, ledger event (726402), sorted ledger accounts.
- post/postWithManager и FinanceEventsService работают через активный manager;
  journal/outbox/receipt/lot/binding атомарны до внешнего commit.
- Outbox поддерживает только journal.posted v1 с обязательным journalId. Lifecycle
  evidence хранится отдельно; coverage events/delivery пока не поддерживаются.

Предыдущие 98 unit и 19 PostgreSQL сценариев — доказательство существующего receipt/
evidence контура, не реализации coverage. Production verifier/authorizer отключены,
FinanceModule не подключён к AppModule. В этом этапе проверки кода/БД не запускались.

Далее **УТВЕРЖДЕНО** означает прямое правило владельца; **ПРОЕКТ** — технический
вариант; **ОТКРЫТО** — ещё необходимое бизнес/accounting решение. Не назначаются тарифы,
проценты резервов, календарные/партнёрские сроки и условия собственного капитала.

## 2. Разделение финансовых понятий

| Понятие | Что доказывает | Чего не доказывает |
| --- | --- | --- |
| Подтверждённый receipt | Фактическое положительное зачисление GBP на счёт компании | Комиссию, право на доход, доступность пользователя, ownership свободных средств |
| Экономическое/юридическое основание | Подтверждённое право и назначение распределения, соответствующие договору/событию | Наличие cash или готовность выплаты |
| Пользовательское обязательство | Долг платформы конкретному пользователю, pending/available/protected состояния | Отдельное банковское поступление или собственный капитал платформы |
| Coverage allocation | Какими фактическими пенсами обеспечена конкретная цель/обязательство | Новый баланс, доход, повторный bank receipt или прекращение обязательства |
| Own-free funds | Доказанная собственная, незащищённая и неиспользованная часть bank-backed средств | Любой bank balance или бухгалтерский доход платформы |
| Cost/fee | Отдельный фактический расход либо утверждённая оценка с происхождением | Разрешение уменьшить пользовательскую долю |
| Payment hold/settlement | Назначение покрытия и затем подтверждённое исполнение внешней операции | Успех по факту отправки запроса/записи outbox |

Receipt allocations (связь receipt с комиссиями/удержаниями) и cost assignments
(распределение parent cost) не потребляют cash повторно. Только единая coverage
система назначает cash. Не создавать параллельные fund_allocations или независимый
spendable balance в commission/user/lot projections.

## 3. Жизненный цикл: неизменяемый origin и отдельные разрешения

ПРОЕКТ: оставить первоначальный funding lot immutable и restricted. Нельзя изменить
его status на free через успешный verifier. Состояние использования — составная
проекция origin + evidence control + разрешение назначения + allocations + settlements.
Один enum для всего lot не описывает частично зарезервированный/использованный остаток.

| Фаза | Требование / результат |
| --- | --- |
| restricted/unclassified | Receipt признан; никаких назначений расходов/пользователей по умолчанию |
| purpose-authorized portion | Проверенный мандат конкретного назначения/ownership/evidence и лимит в пенсах. Это не free platform money |
| held coverage | Пенсы назначены конкретной цели и недоступны для другой независимой цели |
| committed obligation coverage | Покрытие уже признанного обязательства; остаётся защищённым, даже когда выплата не разрешена |
| payment hold | То же покрытие переназначено на выплату/возврат, без второй блокировки тех же пенсов |
| confirmed external use | Только достоверный банковский/provider settlement выводит cash из соответствующего funding origin |
| released hold | Освобождённое назначение возвращает ёмкость в прежний допустимый purpose pool, а не автоматически в own-free |
| blocked | Evidence revoked/другой установленный hold запрещает новые действия; существующие claims/history сохраняются |
| correction/return | Новое подтверждённое событие, версия/case и необходимые отдельные проводки; original receipt/lot не удаляются |

Purpose authorization должна учитывать объект, beneficiary, допустимые ограничения,
scope, доказательства собственности, legal basis, policy version и точную capacity.
Не распределять один lot целиком одновременно на несколько независимых purpose pools.
Company capital/loan/retained income требуют своего подтверждённого основания;
company loan не объявляется unrestricted own-free автоматически.

Восстановление evidence убирает только соответствующий trust hold. Оно не выпускает
allocation, не меняет назначение, не даёт payout eligibility и не отменяет другие holds.
Освобождение protected recipient reserve при долговых операциях не определяется этим
cash coverage жизненным циклом: отдельная bonus lineage/debt policy сохраняется.

## 4. Единая модель coverage: many-to-many без двойного учёта

ПРОЕКТ основных структур:

| Структура | Ключевые поля / смысл |
| --- | --- |
| finance_funding_permissions | permissionId, lotId, purpose/source classification, beneficiary/scope, boundedPence, verifiedBasisReference, policyVersion; immutable revisions. Это мандат, не второе reservation |
| finance_coverage_targets | targetId, kind, domain reference, requiredPence, version, recognition/coverage state. Ссылка на obligation/cost/payment, не второй долг или баланс |
| finance_coverage_allocations | allocationId, lotId, permissionId, targetId, amountPence, state held/committed/payment_hold/settled/released, version и command/event references |
| finance_coverage_events | Append-only command/eventKey, requestHash, actor/policy/input versions, changes/result, journal/domain event references; история authoritative coverage изменений |
| finance_funding_control | Один lock/projection на lot: действующие версии permissions, allocations, внешние settlements/impairments и состояние сверки. Восстановима из неизменяемой истории |

Поля allocations current state/amount являются проекцией; каждое изменение одновременно
фиксирует immutable event. Неизменяемые исходные allocation/event amounts не переписываются
без версии. При частичном переносе/освобождении — fragments с parent/origin references
и conservation; не копирование полной allocation в новый target.

Один receipt/lot → несколько allocations в разные targets. Один target → allocations
из нескольких receipts/lots. Например: lot £10 покрывает target A £6 и B £4; target C
£8 покрывается lot1 £3 + lot2 £5. Это metadata/control, не две новые cash проводки.

Для минимального первого этапа target — **синтетическая тестовая цель покрытия**,
без реального user accrual или payout. В рабочей системе requiredPence следует из
доверенного доменного обязательства, а не client input. finance_obligations/cost_items/
payment jobs вводятся на своих согласованных этапах; coverage target не их замена.

Если coverage_TARGET и domain obligation оба имеют outstandingAmount, один должен быть
проверяемой проекцией/ссылкой на версию другого, не независимым источником истины.
Новая финансовая liability признаётся только ledger+domain командой по approved basis.

## 5. Conservation и запрет двойного покрытия

Все суммы final — GBP bigint pennies, positive command fragments от 1p; промежуточные
расчёты exact, HALF_UP применим к долям. Для сумм aggregates PostgreSQL numeric,
чтобы сумма нескольких bigint не переполнилась; каждый posting остаётся в допустимом bigint.

В нормальном согласованном режиме для lot l:

```text
R_l = первоначальный фактический receipt
S_l = подтверждённые внешние расходы из его ёмкости
W_l = подтверждённое изъятие/возврат ещё существующей ёмкости
K_l = R_l - S_l - W_l                   (остаток bank-backed ёмкости)
A_l = действующие mutually-exclusive allocations этой ёмкости
0 <= A_l <= K_l; available_for_new_purpose <= K_l - A_l
```

Permission limits дополнительно ограничивают назначение. Нераспределённая ёмкость
restricted lot не доступна для arbitrary use, даже при K_l-A_l>0. Own-free available
требует отдельного доказанного мандата, trust eligibility и budget gates.

S_l/W_l — disjoint фактические использования **существовавшей ёмкости**; одно банковское
движение учитывается один раз и с aggregate allocations ≤ фактической суммы.
Internal recognition/reclassification не увеличивает S_l: cash остаётся на банковском
счёте, меняется защищённый beneficiary/target. Нельзя считать «кешбэк начислен» как
external consumed cash и одновременно резервировать то же покрытие снова.

Дополнительно обязательна банковская сверка по scope: суммарная оставшаяся ёмкость
lots не превышает достоверный cash backing соответствующего корпоративного счёта.
Каждый фактический debit/transfer должен иметь один settlement/correction mapping;
неотражённое списание не позволяет считать старую проекцию пригодной для нового reserve.
Банковский balance и учтённый ledger сравниваются, unknown расхождение блокирует
затронутые новые операции до сверки. Holds/fees, уже учтённые allocations, не вычитаются
повторно из того же расчёта. Будущие межсчётные переводы компании требуют отдельной
связи outgoing/incoming origins и не являются новым доходом или удвоением total cash.

Для target t:

```text
nominalCoverage_t = сумма ещё действующих назначений target
trustedCoverage_t = сумма допустимых, bank-backed и не заблокированных частей
gap_t = max(0, requiredUnsettled_t - trustedCoverage_t)
```

Nominal и trusted coverage не два резерва: это разные представления тех же allocations.
Отзыв может уменьшить trusted до нуля без освобождения nominal assignments. Нельзя
повторно потратить «заблокированную» сумму, считая её свободной вследствие hold.
Истинное прекращение target/уменьшение requiredPence требует самостоятельного legal/
domain основания; coverage release не прекращает user liability.

**Payment principal не второй target с новой самостоятельной суммой**, когда уже
покрыт user obligation: allocation атомарно переносится/rebind на payment hold с
ссылкой на тот же principal. Fee — отдельная own-funds allocation на один parent cost.
Budget envelope агрегирует уже назначенные costs, а не резервирует их второй раз.
Child/suballocations одной allocation не суммируются с parent как независимые резервы.

## 6. Расходы, распределение и допуск

УТВЕРЖДЕНО:

| Источник | U / P |
| --- | --- |
| Покупательский кешбэк | 80% / 20% |
| Добровольная вознаграждаемая реклама | 80% / 20% |
| Привлечение участников исследований | 50% / 50% |
| Обычная пассивная реклама сайта | 0% / 100% |

U округляется HALF_UP до пенса, P — остаток G-U. Не применять исследовательские 50/50
к любому денежному вознаграждению исследовательской организации без доказанного referral.
Платформа несёт свои расходы; пользовательские 80% не уменьшаются ради M или cash.

Для новых покупок B61: M=P-C строго >0; C полон и достоверен, включая approved future
cost estimates. C неизвестен — block, не zero. Для остальных направлений нужен явно
утверждённый каталог типов и applicable admission policy; этот документ не расширяет
покупательское B61 на все будущие события и не вводит новые нормы вместо владельца.
Если соответствующий тип требует M>0, проверка такая же; отсутствие policy блокирует
его автоматическое распределение. Исполнение уже возникшего обязательства — не новая
покупка для ретроспективного write-off по M.

Общий допуск нового распределения:
verified legal/economic basis AND applicable margin gate AND complete confirmed cash
coverage AND no double reservation AND verified cost funding AND global budget.
Receipt-only guard проверяет лишь первую часть происхождения cash, не весь допуск.

Удержанные expenses уже уменьшили net receipt; они влияют на M, но не резервируются
повторно как unpaid cash cost. Unpaid expense — payable и cash reservation. Future fee
— approved estimate/bound, а не уже понесённый expense. Shared invoice/fee — один parent
cost и assignments, не полный расход на каждую commission. Safety/operating резерв
не выдумывается: unknown bound/aggregation/horizon блокирует соответствующий автоматизм.

Пример G=£10, U=£8, P=£2: C=£1 → M=£1, экономическая проверка пройдена, остальные
gates ещё обязательны; C=£2 → M=0, block; C=£3 → M=-£1, block. Net receipts £9/£8/£7
не считаются gross £10. Новых проводок или начислений этот документ не создаёт.

## 7. Единая транзакционная граница и lock protocol

Одна бизнес-команда владеет внешней PostgreSQL transaction; все финансовые/domain/
coverage writes и применимый outbox через один active EntityManager. Внутренние методы
не создают/commit/rollback transaction. Возврат provisional, ошибка откатывает всё.
Банковский API, parser, сетевое доказательство и отправка платежа вне SQL transaction.

Предлагаемый полный порядок, расширяющий текущий:

1. Текущий authorization advisory lock (726405,0); trusted role/policy checks.
2. **Все** затронутые account scopes sorted, scope locks 726404.
3. **Все** canonical bank identities sorted, locks 726403, затем operation rows sorted.
   Под locks перечитать evidence/operation state и версии, без fallback.
4. Lot funding_control/permission rows sorted; затем budget/cost/domain/target rows
   в одном опубликованном порядке таблиц и IDs; allocations sorted.
5. Полный набор journal event keys sorted, advisory 726402; sorted ledger accounts.
6. Re-evaluate capacity, target amount/version, legal/cost/margin/budget/provider gates;
   append coverage/domain events, update projections, необходимые journal/outbox записи.
7. External commit; locks держатся до него. Нет нового scope/domain lock после accounts.

Lock set определяется заранее по trusted references, после lock повторно проверяется.
Если mapping/version изменили набор — abort и заново спланировать всю команду; не дозахватывать
scope в обратном порядке. Для первого реализации — одна цель, заранее заданный набор
lots; сложный batch отдельный этап. Совпадение 32-bit hash не proof identity: uniqueness
полных keys обязательна. Отсутствующая control row не защищена FOR UPDATE: создавать
её вместе с lot/разрешённым подготовительным шагом, serialize creation и unique key.

Нельзя просто вызвать assertLotEvidenceWithManager последовательно для lots разных
scopes: существующий helper может взять identity одного scope до scope другого.
Нужен общий prelock collector: сначала все scopes, затем identities; после этого
существующий guard может повторно получить уже удерживаемые locks. Метод не даёт
полное разрешение расходовать, поэтому purpose/capacity checks остаются обязательными.

Revoke берёт существующие authorization/scope/operation guards: reserve/use того же
origin либо завершился ранее, либо после ожидания видит revoked. Необязательно массово
переписывать allocations при revoke: состояние effective trust вычисляется через общий
guard; nominal reservation сохраняется. Все future payout/coverage/correction paths
обязаны брать этот guard. Одной финальной проверки «после распределения» недостаточно.

Бюджет/обязательство как доменный aggregate также должен менять состояние только по
единому протоколу. Изменение due без scope locks может быть отдельной доменной командой,
если она не берёт scope позднее и increment version; coverage rechecks её version
под domain lock. Любой financial consume выполняет полный protocol. READ COMMITTED
с after-lock reads; serialization/deadlock → полный rollback/replay, не часть postings.

## 8. Команды coverage и идемпотентность

ПРОЕКТ API, не существующие методы:

```ts
authorizePurposeWithManager(manager, trustedContext, command)
reserveCoverageWithManager(manager, trustedContext, command)
reassignCoverageWithManager(manager, trustedContext, command)
releaseCoverageWithManager(manager, trustedContext, command)
preparePaymentHoldWithManager(manager, trustedContext, command)
confirmExternalUseWithManager(manager, trustedContext, command)
recordFundingImpairmentWithManager(manager, trustedContext, command)
readCoverage(manager, targetOrLotReference)
```

Команда содержит opaque idempotency key, schemaVersion/type, trusted domain target/
permission IDs, ожидаемые версии, fragments lotId/amountPence, evidence/basis references.
Не содержит банковских credentials, полномочий в виде произвольной роли, клиентского
available balance или указания free=true. Авторизация coverage — отдельные действия
и trusted policy; evidence_reviewer/controller не получают право распределения автоматически.

Один namespaced command key + canonical materialHash + UNIQUE DB constraint. Hash
нормализует UUIDs/пенсы, field order и sorted независимые fragments; JSONB order не влияет.
Replay не новые allocations/journal/outbox. Changed material → conflict; rollback
не закрепляет key как успешный. Lock key сериализуется до чтения command record в
порядке, совместимом с authorization gate и остальными commands.

Для blocked evidence предлагается refused replay с original coverage/receipt references,
без успеха нового использования. Отдельный read-only history возвращает прошлый outcome.
Исторический command result и current allocation/evidence state различаются: old replay
не снимает новый hold и не повторяет release/payment. Точную coverage replay policy
утвердить до реализации, сохраняя уже утверждённый receipt replay отказ.

## 9. Частичное покрытие и переназначение

Вариант A: reserve только если полное требуемое покрытие и fee/budget проверены;
недостаток — отказ без частичного hold. Проще и рекомендуется для первого этапа.

Вариант B: документированный partial coverage state с явным недостающим amount;
несколько receipts пополняют одну цель. Допустим только после утверждения правил
приоритета, удержания/освобождения и запрета starving других обязательств. Частичное
покрытие не создаёт доступный кешбэк и не позволяет частичную payout как default.
Нельзя назначать TTL частичного hold или произвольный deadline освобождения.

Reassign замещает A→B атомарно под всеми исходными/целевыми locks. Уже признанное
обязательство A нельзя оставить непокрытым ради нового B без разрешённого основания
и замещающего допустимого покрытия. Payment retarget сохраняет beneficiary/principal.
Release pending proposal можно возвратить в прежний purpose pool; release покрытия
existing liability требует settlement/legal correction или одновременно replacement.

Долговой зачёт — внутренняя сбалансированная операция, не новый bank receipt или доход.
Его cash coverage может перейти к merchant obligation только по отдельному approved
domain workflow, с lineage и ограничением размера долга. Долг пользователя сам по
себе не received cash и не заменяет покрытие. Защищённые recipient reserves/used amounts
нельзя изымать; разрешённые debtor own funds/reserves имеют отдельные правила.

## 10. Payout holds, fees и неопределённый результат

УТВЕРЖДЕНО B64–B65: triggers £10 доступных средств и шесть calendar months от original
confirmed unused/unpaid origin используют общий gate. Principal > full provider fee,
fee отдельно за счёт confirmed own-free платформы; provider/security/no debt/budget/
полное principal cover обязательны. Protected reserves исключены. Funds/date не сгорают.

Payout claim один независимо от двух triggers. Перенос principal coverage на job hold
не повторный reservation. Fee покрывается отдельными допустимыми own funds, не user
principal. Policy распределения будущих fee между purchases/cohorts остаётся открытой.
Уменьшение fee estimate после actual reconciliation не освобождает лишнее автоматически
в platform profit без проверки исходного purpose/budget.

Состояние отправки/outcome_unknown удерживает principal и fee capacity согласно
достоверному charge status, не освобождает по таймеру. Сначала установить судьбу
исходного платежа, затем разрешённый retry той же identity; запрещён новый независимый
transfer для того же principal. Списание lot cash только по trusted execution evidence.
Provider отказ не доказывает, что fee не взималась: подтвердить charge отдельно.
Merchant refund — отдельная job/obligation, но та же coverage дисциплина.

## 11. Отзыв, impairment, возвраты и уже возникшие обязательства

Отзыв evidence не является bank debit. R/S/W ledger не меняются только из-за revoke;
nominal assignments остаются, effective trusted coverage блокируется. Новые reserve/
reassign/payment submission запрещены для origin. Незатронутые операции не получают
автоматический account-wide hold. Незавершённый внешний платёж со статусом unknown
не отменяется простым release: reconciliation и отсутствие повторной отправки.

Если reserve/use выиграл lock до revoke, история сохраняется; revoke запрещает новые
действия и открывает сверку текущего покрытия. Если revoke первый, reserve/use после
ожидания отказывает. Восстановление с independent review/controller не освобождает
nominal reservations и не меняет restricted origin/прочие purpose ограничения.

При реальном bank reversal/исправлении: новое confirmed event/case, source identity,
сумма, original links, отдельные accounting entries после разрешённого policy.
Сумма возврата из оставшейся ёмкости уменьшает K, а affected coverage становится impaired,
не silently released для нового расходования. При уже потраченной ёмкости возможна
утрата cash покрытия других claims/платформы: **не назначать тот же penny второй раз
как исходный external spend и ещё одно потребление той же ёмкости**.

Нормальная формула раздела 5 не объясняет excess reversal после предыдущей выплаты.
Он требует отдельного funding incident/gap и confirmed bank movement, а не отрицательного
available lot. Схема должна уметь сохранять nominal historical claims с funding gap:
нельзя поставить общий CHECK «все nominal claims всегда ≤ действительный cash», который
не даст записать реальный убыток. Constraints запрета overbooking применяются к новым
здоровым назначениям; auditable impairment сохраняет claims и снижает trusted coverage.
Порядок отнесения impairment к нескольким targets требует утверждения. До решения
весь затронутый origin недоступен для новых использований, без присвоения чужих денег.

User/seller legal liabilities **не списываются** при funding gap, M≤0 или отозванном
proof. Их amounts/originalConfirmedAt сохраняются; pending/available status и ограничения
выплаты объясняются, требуется урегулирование. Replacement cover только допустимыми
подтверждёнными средствами после atomic checks, не другими защищёнными user funds.
Не финансировать новые убыточные commissions own cash; fulfilment уже существующих
claims — отдельная обязанность, которую admission guard не отменяет.

Если реальный bank debit даёт отрицательный банковский остаток/неучтённый overdraft,
текущий nonnegative company_bank_cash не моделирует это полностью. Не отключать guard,
не терять банковское событие и не изобретать credit receipt; требуется approved deficit/
overdraft accounting/reconciliation перед commercial integration. Это отдельный blocker
correction stage, не разрешение проводить непокрытые новые allocations.

## 12. PostgreSQL ограничения и outbox

Предлагаемая additive finance миграция, без изменения применённых baseline:

- PK/FK на receipt/lot/operation/permission/target/command; NO CASCADE удаления денег,
  immutable history и запрет TRUNCATE/изменения finalized event.
- Positive GBP bigint amounts, bounded fragment amounts, UUID/canonical keys,
  UNIQUE command key, UNIQUE settlement bank/provider identity; уникальность target
  domain reference/version/вид операции для защиты от разных keys одного начисления.
- Initial lot control при подготовке; current projections с version. Derived counters
  не обновляются произвольным SQL, только атомарными event/projection commands.
- Cross-row sums: lock lot и target, затем deferred constraints/constraint triggers
  проверяют sum allocations и permission partitions, здоровую capacity и target cover.
  Простой row CHECK или SELECT SUM без parent lock не исключает write skew.
- Concurrent payment claims/principal fragments не повторяют родительскую allocation;
  settlement total и fee assignments согласованы с одним parent event/cost.
- Impairment transition отдельно защищён evidence/role/audit; не blanket отключение
  capacity guards. DB constraints не подтверждают реальные банковские документы/роли.
- Application DB роли не имеют generic direct write bypass; DBA/superuser отдельно
  аудируется. Это ещё не настроено/не проверено существующими integration tests.

Coverage reserve без accounting изменения не порождает фиктивный journal. Существующий
journal outbox сохраняется для настоящих проводок; для coverage/domain transitions
нужен отдельно типизированный event contract с отсутствующим journal либо отдельный
domain outbox. Рекомендация: переиспользовать transactional outbox механизм через
явное расширение envelope/category и условные constraints, сохраняя strict v1 ledger
invariants; конкретный вариант schema утвердить после оценки текущего обязательного
journalId UNIQUE/FK и triggers. Не делать одинаковые deliverable events в двух таблицах.

Domain/coverage history и единственный соответствующий deliverable event атомарны;
at-least-once/idempotent consumers. Ни worker, ни provider command этим этапом не
включаются. Outbox запись не означает cash use, payable execution или ledger commit.

## 13. Конкурентные и контрольные сценарии

| Сценарий | Ожидаемая защита / результат |
| --- | --- |
| Два reserve на lot £10 по £7 | Первый commits, второй after-lock видит £3 и отказывает; суммарно не £14 |
| Один lot, два разных obligations | Только disjoint fragments; exact pennies и shared parent capacity |
| Два lots на один target | Target lock/version не допускает перепокрытие; отсутствуют новые liabilities от reserve |
| Same key same material | Recorded outcome без новых allocations/journal/outbox; active state отдельно |
| Same key changed material / разные keys одной операции | Conflict/unique domain guard; нет повторного accrual/coverage |
| Revoke-first vs reserve | Второй ждёт и отказывает, никаких committed coverage изменений |
| Reserve-first vs revoke | История coverage сохранена, effective usability blocked; nominal не становится free |
| Partial cover | В A всё rollback; в B явно partial/gap, без availability/payout и произвольного TTL |
| Failure после fragment/ledger/outbox | Полный outer rollback, ключ не consumed, retry безопасен |
| Release vs payout preparation | Одни allocation/target locks; нельзя освободить отправленный или неизвестный payment hold |
| Payment principal + fee | Parent principal только один раз; fee отдельно own-free, exact quote и budget |
| Blocked evidence / orphan legacy lot | Guard отказ, даже если арифметически K>0; нет unsafe fallback |
| Restore | Independent current reviewer/controller; restricted и существующие allocations неизменны |
| Partial/full reversal, late corrections | Confirmed event once; no original DELETE/UPDATE; impaired cover/gap сохраняют liability |
| Unknown fee/budget/cost | New distribution blocked, user share не уменьшена |
| M=0 / M<0 / M>0 и нет cash | Первые две blocked; последняя тоже blocked по coverage |
| Double bank recognition | Reserve/reassign/distribution не увеличивают bank cash; только external confirmed movements меняют актив |
| Transfers/debt/protected reserves | Origin/date сохраняются; нельзя платёж/расход из защищённых сумм; debt priority без нового дохода |
| API/statement aliases/ambiguous duplicate | Canonical operation shared; quarantined observation не второй receipt/lot |

Нужны unit exact arithmetic/conservation/state tests и PostgreSQL tests с несколькими
соединениями, барьерами locks и pg_blocking_pids, без timer sleeps как доказательства.
Проверять commit visibility, rollback по стадиям, FK/unique/immutable guards, concurrent
capacity/target updates, version/deadlock replay, rebuild projections и reconciliation
с ledger. Реальные банковские и платёжные capabilities не тестируются synthetic fixtures.

## 14. Открытые решения владельца

| Решение | Рекомендуемый вариант / зачем необходимо |
| --- | --- |
| Основание назначения restricted portions и полномочия | Явные source/legal/purpose policies и trusted coverage actions; evidence roles не автоматически finance distributors |
| Own-free классификация | Только доказанное ownership, отсутствие защищённых claims и budget constraints; отдельно capital/loan/retained income policy |
| Полное vs частичное coverage | Первым выбрать full atomic reservation; partial позже с правилами удержания/приоритета, без назначенного TTL |
| Выбор lots/targets и очередность claims | Детерминированная owner-approved политика; FIFO/pro-rata/earliest-origin не вводить автоматически, особенно при долгах и дефиците |
| Margin policy других источников | Подтвердить applicable type catalogue; B61 строго для новых покупок, не ретроспективное прекращение claims |
| Понятие полного C и fees attribution | Approved future bound/cohort/shared cost rules; неизвестный расход не ноль |
| Budget/safety/operating envelope | Утверждённые scenarios/horizon/aggregation, без произвольного процента или тарифа |
| Legal/accounting recognition и reclassification entries | Receipt-only уже утверждён; новые commission/user liability/expense/own-funds проводки ещё требуют однозначного основания |
| Coverage release/reassign и replay на revoked origin | Предлагается отказ новых использований + historical lookup, release в прежний purpose; legal liabilities не прекращаются |
| Impairment/reversal/дефицит | Ответственность, priority losses, replacement funding и accounting negative bank situation; не искажать реальный факт |
| Payment settlement/unknown outcome | Проверенные provider statuses, fees, source-to-lot attribution; нет ручного owner approval каждого платежа |
| Domain outbox schema | Явное расширение без фиктивного journal и нарушения прежнего ledger v1 |

Все эти решения относятся к соответствующим этапам. Отсутствующий payout тариф,
return window или international functionality не повод задерживать изолированный
синтетический capacity/guard тест, но блокирует реальный automated distribution/payment.
Подтверждённые денежные средства бессрочны; 3/6-month milestones, original dates,
£10 trigger, fee borne platform, UK/GBP и правила долга и защиты получателя не меняются.

## 15. Минимальный безопасный следующий этап

Предложение 6В.5.6-Б после отдельного разрешения:

1. Утвердить full-cover-only вариант и тестовые purpose/target semantics; реальная
   классификация/own-free остаётся выключенной. Не обновлять immutable lot.status.
2. Finance-only coverage target/permission/allocation/event/control schema и отдельная
   migration; synthetic authorizer/purpose verifier только в тестах, defaults closed.
3. Active-manager reserve/release, exact capacity/target conservation, общий prelock
   collector и existing evidence guard. Отказ при revoked/unapproved/orphan lot.
4. Изолированные unit/PostgreSQL tests full cover/many-to-many/replay/conflict/revoke/
   rollback/deferred checks. До любого DDL сверить точную finance-БД/роль/OID/schema/history.
5. Ни real accrual, ни user/merchant payment, ни own-free release, ни reversal postings,
   ни AppModule integration. State/event audit без ложной accounting записи.

Readiness: existing receipt/evidence/ledger suites не ослаблены; no double coverage;
unknown policies закрывают путь; nominal obligations сохраняются при hold; full external
transaction доказана; main DB/frontend/legacy механизмы untouched. Многопокупочная
commission атрибуция и однократное использование бонусов к самому дорогому заказу
остаются отдельным domain stage, не вычисляются funding lots.

## 16. Контроль этапа

Создан только work/finance-6v5-6A-funding-coverage-design.md. Согласованные документы,
код, миграции и тесты не изменены. Не выполнялись tests/build, DDL/DML, банковские
подключения, Docker или Git commit/push/pull/fetch. Финансовые назначения и выплаты
не создавались. После проектного отчёта — остановка до отдельного разрешения.
