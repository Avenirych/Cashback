# Cashback+ 6В.5.3-А — единый проект денежных средств и покрытия

Дата 14.10.2026. Проект на утверждение, не разрешение реализации. Источники:
BUSINESS_SPEC_6B_FINAL.md (включая §14), finance-6v5-integration-plan.md, текущий
src/finance и окончательное решение владельца о строго положительной марже. Последнее
решение отменяет вариант 1A автоматического субсидирования. Сам файл BUSINESS_SPEC
в этом этапе не меняется; его более ранние предложения о покрытии убыточной
комиссии не имеют приоритета над текущим решением владельца.

## 1. Базовые инварианты и сравнение моделей

Утверждено: GBP; gross purchase commission 80/20, HALF_UP user и platform remainder;
processing costs платформы, user principal не уменьшать; new-operation margin strictly >0 and sufficient cash; unknown cost не zero; existing legal liability не
аннулировать; защищённые чужие средства не источник platform expense.

Модель A (fund_allocations/control_decisions/obligations) явно выражает назначения,
решение допуска и legal obligation, но без origin денежных активов может опираться
на условный остаток. Модель B (funding_lots/coverage_allocations/corrections) сохраняет
денежную родословную и конкурентное покрытие, но сама не определяет контроль маржи
и правовую природу обязательства. Две параллельные allocation-системы создают риск
двух available balances и двойного расходования.

Выбор: actual receipts + funding lots + ОДНА coverage_allocations система; explicit
obligations и costs; контроль/correction history в ОДНОМ журнале domain событий.
Отдельных fund_allocations и commission_corrections поверх этого не создавать.
Ledger — бухгалтерская истина; lots/allocations — единственная истина назначения
конкретных денег. Эти два измерения регулярно reconcile, не взаимозаменяемы.
Кеш в проекции допустим только с проверкой восстановления из ledger/allocations.

## 2. Минимальная схема сущностей (предлагаемая)

| Таблица | Значимые поля и защита |
| --- | --- |
| finance_bank_receipts | receiptId, bank/source transaction namespace+ID UNIQUE, GBP actualPence, value/receivedAt, verification status, evidence reference/hash, bank journalId UNIQUE |
| finance_funding_lots | lotId, receiptId, actualPence, source class, permissible purpose/scope, evidence of ownership/restrictions; сумма частей receipt равна actualPence |
| finance_partner_commissions | partner+commission ID UNIQUE, order/user references, confirmedGrossPence, confirmed revision, eligibility/evidence, state, distribution journal link |
| finance_receipt_allocations | immutable allocation ID, receipt/commission linkage, covered cash pence, supported withheld cost link, reversal/reference; no cash posting by itself |
| finance_cost_items | unique evidence line ID, amount/GBP, class, confirmation, withheld/unpaid/paid, estimate validity/policy, external settlement link; unknown distinct from zero |
| finance_cost_assignments | cost item → commission or platform budget, allocated amount, policy/version; no double attribution, сумма не больше подтверждённого cost item |
| finance_obligations | beneficiary kind/id, legal source/evidence, original/current due, state; accounting links, not independent spendable balance |
| finance_coverage_allocations | lot → obligation/expense/payment/own-free designation, exact pence, held/consumed/released lifecycle, canonical command key; no duplicate fund_allocations |
| finance_operation_events | typed receipt/commission revision/control decision/correction event, original operation, source/reason/evidence, input versions, decision/reconciliation state, journals/outbox links |

Существующие finance_accounts/journals/postings/outbox сохраняются. Domain event
schema и новые accounting kinds расширяются отдельной будущей миграцией, не через
переписывание уже применённых baseline миграций. Current outbox generic journal fact
не заменяет эти domain records. Future bank payment jobs — отдельный следующий этап.

receipt_allocations и coverage_allocations не дубликаты: первые доказывают, какая
комиссия закрыта каким банковским receipt/удержанием; вторые резервируют фактические
деньги под обязательства и расходы. Receipt link не даёт второе право расходования.
Не хранить в commission ещё один безусловно spendable available balance.

Для минимального первого scope cost item относится напрямую к одной commission,
если это доказано. Shared fee поддерживается cost_assignments, а не копированием
полного fee на каждую commission. Если распределение shared fee не определено,
комиссии этой группы блокируются до сверки/утверждённой policy.

## 3. План бухгалтерских счетов

| Роль | Нормальная сторона / смысл |
| --- | --- |
| Company bank cash | Debit asset; только подтверждённые фактические банковские движения |
| Partner commission receivable | Debit asset; только подтверждённое право требования, не деньги и не payout coverage |
| Unallocated received funds | Credit suspense/liability, фактическая сумма до классификации |
| Gross commission pending classification | Credit deferred/suspense, признанная gross база до разрешённого split |
| User pending_return_window | Credit liability; no withdraw/transfer/use |
| User available / protected reservation / payout hold | Credit liability subaccounts; internal reclassification, no new cash/income |
| Platform commission income | Credit; once-only confirmed/received platform share |
| Processing/payment expenses | Debit; отдельно от gross user share |
| Unpaid cost payable / merchant payable | Credit liabilities, защищённое покрытие |
| Capital/equity, accumulated result | Credit equity/control; сами не доказательство свободного cash |
| User debt receivable | Debit; не считать долг полученными деньгами |

«Свободные собственные средства» — классифицированная и подтверждённая часть
bank-backed funding lots, не новая прибыль и не отдельный банковский приход.
Можно иметь equity/management subaccounts, но внутреннее earmarking не создаёт
income/bank asset. Pending gross или receivable нельзя подставлять вместо денег.
Резерв на выплату остаётся user liability; отдельно держится cash fee budget.

## 4. Доказательства и классификация

Bank receipt: authenticated bank statement/API/credit advice с stable transaction
ID, GBP actual amount/date и evidence; webhook partner order сам не receipt.
Ручная загрузка bank evidence допустима как источник только после отдельно
утверждённого verification процесса; этот проект не объявляет её подтверждённой.

Commission: partner settlement report/confirmed revision, связь с orders,
gross amount и documented deductions. Gross commission correction не fee.
Withheld fee: отчёт settlement, invoice/evidence line и reconciliation
receivable → cash + удержание; это же удержание не отражать второй раз как future payable.
Unpaid cost: verified invoice/contract/service evidence, due amount/status;
paid movement связан с тем же cost item, а не новым расходом второй раз.
Estimate: утверждённая conservative policy/quote, scope и validity, явная оценка,
не фактически оплаченный расход. Без достаточной policy unknown остаётся unknown.

Own free funds: verified bank receipt, доказанное ownership/purpose (например,
company capital contribution, unrestricted accumulated cash income), reconciliation
с ledger и отсутствие чужих обязательств/holds/целевого назначения. Company loan
не автоматически unrestricted free: учитывать lender conditions/repayment и
не объявлять его пригодным без policy. Тестовый clearing credit не evidence.

Все evidence references — минимальные непрозрачные ID/hash с controlled access.
Банковские реквизиты пользователей/credentials не помещать в event payload/outbox.

## 5. Четыре класса расходов

1. **Уже удержанные:** экономический расход учитывается в марже; liquidity уже
   отражает net receipt. Не вычитать fee снова как ещё не оплаченный cash расход.
2. **Подтверждённые unpaid:** экономический расход + cost payable; денежное покрытие
   зарезервировать до признания новых user obligations. Оплата не повторяет expense.
3. **Будущие оценочные:** известный policy-based bound/quote резервируется по
   утверждённому варианту. Не выдавать reserve за окончательный statutory expense.
4. **Общие operating расходы:** фиксируются в platform budget и global liquidity;
   не произвольно приписывать одной commission. Их allocation в per-operation margin
   требует owner-approved policy; global cash budget при этом обязателен.

Каждый cost имеет одно evidence identity. Одну invoice sum нельзя полностью
включить в несколько commissions и одновременно снова вычесть в platform budget.

## 6. Проверяемая маржа и бюджет

G — confirmed corrected gross pence; U=HALF_UP(G*80/100); P=G-U.
C_known — уникальные относимые фактические/подтверждённые расходы.
C_future_bound — утверждённые bounds необходимых будущих расходов.
C = C_known + C_future_bound (полные относимые расходы, без двойного учёта).
M = P - C; автоматический экономический допуск только при M > 0.
M = 0 или M < 0 — блокировка нового распределения до сверки.
Без доказательства completeness costs или approved bound решение blocked_unknown_cost.
Нельзя повышать margin добавлением капитала или own cash: финансирование не доход
данной commission. Own free cash не оправдывает отрицательную операционную маржу.

Platform budget — версии обязательных общих costs и конкретно earmarked own-free
funds. Budget forecast не равен available cash и не создаёт банковские средства.
Две проверки обязательны: per-operation margin и aggregate company funding.
Расход, учтённый в commission coverage, не резервируется второй раз как тот же
budget payable; different known obligations остаются самостоятельными.

Резерв безопасности/размер overhead/срок прогноза здесь НЕ задаются. Выбор владельца:
- block при любой неизвестной относимой стоимости: меньше throughput, без скрытого нуля;
- approved conservative bound: больше разрешённых операций, требуется обоснование,
  период пересмотра, enforcement и освобождение избытка без нового income;
- общий budget cap/earmark: защита operating liquidity, но не заменяет individual margin.
Нулевая margin НЕ допускается новым решением владельца. Порог — строго M > 0;
для целых пенсов это минимум 1 пенс, математическое следствие, не новый тариф.
Дополнительный процент safety reserve или иной порог здесь не назначается.

## 7. Liquidity/coverage algorithm

1. Проверить receipt evidence, exact GBP, purpose и отсутствие дубликата bank ID.
2. Reconcile gross settlement: выделенный net cash + подтверждённые withheld costs
   + documented correction = соответствующая gross commission revision. Unknown
   difference блокирует; algebraic совпадение без evidence недостаточно.
3. Проверить 6-й раздел. Заблокированное новое распределение не создаёт новых
   user pending obligations. Если liability уже юридически возникла — сохранить
   её независимо, пометить uncovered/reconciliation_required, не скрывать отсутствие cash.
4. Определить нужное cash покрытие: U + confirmed unpaid attributable costs +
   approved future cost reserves. Already withheld costs сюда повторно не добавлять.
5. Выбрать только allocated-purpose receipt cash и допустимые own-free lots.
   Нельзя user obligations, protected reserves, other payout holds или unrelated
   targeted/unallocated receipts. No subsidy при negative margin даже если own-free есть.
6. Atomic allocate покрытия и зафиксировать decision input versions, journal/outbox,
   state pending_return_window. Доступность не освобождать в этом этапе.

Free(lot) = actual original cash - consumed external spends - active coverage
assignments. Состояния должны образовывать непересекающееся partition; внутренний
release может дать free обратно, consumption — не второй доступный остаток.
Ledger bank asset и сумма актуальных fund positions reconcile с bank statements.
Внутреннее allocating меняет purpose, не увеличивает assets/income.

## 8. Транзакционная/конкурентная защита

Один active EntityManager. Canonical domain identity + same payload replay сначала;
commission revision, costs, evidence versions, involved funding lots и obligations
блокируются детерминированно, затем sorted ledger accounts. Re-evaluate под locks.
No negative free lot; no coverage assignment over lot; commissions нельзя распределить
более одного раза. Обязательны уникальные partner IDs, bank IDs, allocation/command IDs
и FK/constraints. Aggregate constraints требуют locks и deferred DB проверки;
одной проверки SELECT до транзакции недостаточно.

Controller/worker не получает свободный доступ к generic ledger posting. Отдельный
privileged ledger adapter, schema-qualified SQL и DB roles исключают обход allocation
через raw write. PostWithManager не commit; error aborts entire outer transaction.
Decision/domain/journal/outbox provisional до commit. No external bank call внутри.

## 9. Many-to-many receipt/commission

Один receipt нескольких комиссий: partition cash единственный; receipt_allocations
разносят confirmed settlement evidence, coverage_allocations — конкретные cash
parts. Сумма cash assignments не превышает actual receipt; shared fee распределяется
один раз. Split каждой commission independent, user shares дополнительных orders
не становятся platform income.
Несколько receipts одной commission: подтверждённые allocation fragments суммируются
под commission lock. Partial coverage не разрешает полный user accrual. Until full
margin/coverage checks passed: awaiting_coverage/reconciliation. Exact same allocation
replay no effect; новый ключ той же bank event не создаёт вторую receipt.

## 10. Поздние корректировки, состояния и legal obligations

Suggested states: evidence_pending, awaiting_coverage, reconciliation_required,
ready_for_distribution, distributed_pending_return_window. State требует evidence,
не равен sealed journal/outbox delivered. Конкретные transition names технические.

Pre-distribution correction меняет confirmed revision/base при canonical evidence,
пересчитывает margin/coverage, releases only uncommitted/allowed earmarks according
policy; историю версий не терять. Post-distribution correction — отдельный
finance_operation_events correction с origin commission, confirmed amount, reason,
source и reconciliation status. Никаких automatic correction postings/user changes
в scope 2A. Original journal immutable; повтор correction сохраняет один event.
Legal obligation сохраняется с independent due/settlement evidence и flag funding gap.
No profitability guard writes it off. Legal recognition basis требует решения владельца.

## 11. Примеры проводок £10 (предлагаемая accounting policy)

Чтобы не считать deduction фиктивным bank cash, показать двухфазную gross settlement.
Признание права требования требует доказанного юридического/accounting основания;
если его нет, не делать receivable journal, держать evidence на сверке.

Для confirmed right £10: Дт partner receivable £10 / Кт gross pending classification £10.
Это НЕ фактическое поступление и НЕ доступные деньги.

| Случай | Bank settlement | Решение |
| --- | --- | --- |
| Withheld £1, received £9 | Дт bank £9; Дт processing expense £1; Кт partner receivable £10 | margin £1, user cash coverage £8; split допустим при прочих checks |
| Withheld £2, received £8 | Дт bank £8; Дт processing expense £2; Кт partner receivable £10 | margin £0, user coverage £8; новое распределение блокируется, даже при достаточном cash |
| Withheld £3, received £7 | Дт bank £7; Дт processing expense £3; Кт partner receivable £10 | margin -£1 и user coverage gap £1: новое распределение blocked |

Только в первом случае, после отдельных coverage/budget проверок: Дт gross pending £10 / Кт user pending £8 /
Кт platform income £2. Bank asset не увеличивается повторно. Net result разрешённого первого случая £1;
free actual platform cash после earmark user — £1, не £2. Во втором и третьем
случаях новых user allocation/split нет; реальные receipts/costs и существующие
юридические обязательства не исчезают из учёта из-за блокировки.
Во втором и третьем случаях реальные cash/expense/right отражаются только по доказанному
accounting basis; split НЕ проводится. Не скрывать уже понесённый убыток запретом
новой операции. Pending gross не считать свободной прибылью. Если user legal claim
уже есть, отражать обязательство отдельно и gap; exact recognition entries требуют
legal/accounting policy, не создаются fictitious funding.

Альтернатива до утверждения receivable recognition: record actual bank receipt
Дт bank net / Кт unallocated received net; gross/deduction evidence domain-only до
сверки. Нельзя использовать этот net suspense как будто там лежит gross £10.
Выбор accounting recognition (receivable/deferred vs receipt-only) — owner/accountant
решение до реализации, а не две параллельные accounting truths.

## 12. Будущие user payout fees и шестимесячный trigger

User principal целиком, fee платформы отдельно. Перед новым распределением необходим
approved estimate/bound относимой payout cost либо блокировка неизвестной стоимости.
Как fee общего batch отнести к комиссиям — отдельная policy. Не назначать fee=0
из-за того, что payout произойдёт позднее. Budget зарезервирует cash fee, user liability
cover сохраняется независимо. При изменении quote перед payment проверить реальный
fee budget снова, не уменьшить user principal и не списать уже возникшее обязательство.

Обычный £10 trigger и age-6-calendar-months — разные причины одной идемпотентной job.
Для возрастного payout дополнительно user available amount > full fee, provider
minimum/security/no debt/funding. Fee сравнивается, но не вычитается. Protected reserves
excluded. Если fee/выплата невозможны — liability остаётся бессрочно, не income.
Unknown result reconciliation до retry. Calendar/tie policy из §14 не додумывать.

Большой будущий fee может сделать новую commission margin negative: distribution
блокируется ДО возникновения нового voluntary obligation. Но fee, ставший выше
ПОСЛЕ возникновения liability, не разрешает её отменить; требуется budget/reconciliation.
Пример £1 payout с fee более £1 не задаётся как реальная цена провайдера: данные
должны быть проверены. Никакого safety reserve size здесь не утверждается.

## 13. Что можно автоматизировать и что блокирует реализацию

Можно после отдельного технического разрешения: exact HALF_UP, duplicate detection,
unique evidence/allocations, amount conservation, locks, strict-positive-margin guard (zero also blocked),
unknown-data block, no protected-purpose consumption, immutable decisions/corrections,
atomic journal/domain/outbox. Реального автоматического начисления сейчас нет.

Нужны решения владельца/accountant: receivable/revenue recognition policy и legal
basis; complete cost catalogue; shared cost attribution; future fee bound/model;
operating budget forecast/earmark и safety policy; free-own evidence/verification;
existing liability recognition при непокрытии; unknown reserve release conditions.
Сохраняются открытые return-window/attribution/multi-order metric/tie/late policy,
UK/provider suitability. Эти вопросы блокируют соответствующие операции, не
изолированные validators/schema design. No arbitrary partner days or reserve size.

## 14. Поэтапная реализация после approval

A. Утвердить этот project/accounting вариант, cost completeness и funding policy.
B. Добавить domain evidence/contracts и future finance-only migrations; account
kinds, unique constraints, fake unit fixtures. Не включать FinanceModule.
C. Isolated PostgreSQL: bank receipt once, many-to-many, fund partition, duplicate
cost identity, atomic concurrent coverage, no cross-purpose use и rollback.
D. Commission control handler: withheld £1 passes economic check only when all
costs complete, then separate coverage/budget checks; £2/£3 blocked even with own cash; unknown fee/partial receipt blocked; preserve legal claim.
E. Pending user distribution + outbox, post-correction reconciliation only (2A).
F. Future payout cost/age policy и adapters отдельным scope, без real payments до
provider/legal checks. Primary database migration/deployment отдельно разрешаются.

Release gate: all debt/reserve/ownership exclusions intact, no repeated bank assets,
no unsupported financial proof, existing user liabilities survive guards. No demo
import/cleanup, no src/business/UI changes в проектном этапе.

## 15. Контроль изменений

Создан только этот новый report в work/. Source/migrations/tests/specification,
main и finance databases, Docker/volumes/backups не менялись. No tests/build/network
payments/Git mutations. Исходный HEAD/status/index сохранены.


## 16. Окончательное правило допуска новых покупок

УТВЕРЖДЕНО владельцем 14.10.2026: G — confirmed gross pennies;
U=HALF_UP(G*80%); P=G-U; C — полные относимые costs, включая утверждённые estimates;
M=P-C. Только M>0 разрешает экономический допуск. Недостоверный C блокирует.
Уменьшать U ради margin запрещено. Без automatic subsidy отрицательной/нулевой
маржи собственными cash: funding не меняет income/margin операции.

Допуск = positive verified margin AND confirmed cash coverage AND отсутствие
повторного резервирования AND общий budget control. Успех первого условия
не заменяет три остальных. Проверка inputs/version/locks и окончательное решение
должны быть атомарны. Критерий применяется к новым operations/distributions,
а не к write-off уже возникших legal obligations; они сохраняются и урегулируются.

Для G=1000p U=800p P=200p: C=100p → M=100p, economic pass;
C=200p → M=0p, blocked; C=300p → M=-100p, blocked. Эти costs только иллюстрации,
не тарифы провайдера. Unknown future costs не zero. No arbitrary safety reserve.
