# Cashback+ 6В.5.3-Б — полная стоимость и финансовые резервы

Дата: 14.10.2026. Только проект на утверждение. Согласованные документы не изменены.
Источники: BUSINESS_SPEC_6B_FINAL (§14, B61–B63), finance-6v5-3A-funds-coverage-design,
finance-6v5-integration-plan, текущее src/finance. Ниже рекомендации не становятся
бизнес-правилами до approval. Тарифы, проценты риска, сроки партнёров не назначаются.

## 1. Инварианты и область payout условия

Утверждено: G gross GBP pennies; U=HALF_UP(G*80%); P=G-U; C full attributable
costs включая approved future estimates; M=P-C строго >0 для нового распределения.
Economic pass не заменяет cash coverage, no-double-reserve и global budget control.
User U не уменьшается, fees платформы. Existing legal obligation сохраняется,
confirmed funds не expire. Protected recipients/reserves сохраняются.

£10 — обычный automatic payout trigger. Шестимесячный trigger — возраст самого
раннего confirmed unused origin, transfer не обновляет дату; payout всего доступного
eligible остатка, в том числе <£10, при no debt/provider/security/funding conditions.
Окончательное B64 требует amount>full fee для ОБОИХ trigger.
Этот вопрос больше не открыт. Fee оплачивает платформа отдельно; оба trigger
также требуют confirmed own-free fee cover, user principal cover, no debt,
protected reserve exclusion, provider/security и budget checks.
Provider minimum применяется к обоим. При невозможности payout liability остаётся.

Экономический reserve C_future не является фактически понесённым expense;
денежный earmark не есть bank spend. Три вещи должны быть связаны, но не суммироваться
трижды: cost estimate, cash reserve и последующий actual fee.

## 2. Классификация полной стоимости

| Категория | Evidence | Признание / оценка | Anti-double-count |
| --- | --- | --- | --- |
| Withheld partner fee | confirmed settlement line + net bank receipt reconciliation | actual fee при установленном основании, gross basis не уменьшать | один fee ID; cash уже net, не резервировать как unpaid второй раз |
| Confirmed unpaid cost | invoice/contract/service confirmation, due/settlement status | actual expense/payable по agreed accounting basis; cash earmark до оплаты | paid переводит тот же item, не второй expense |
| Expected processing cost | действующая partner schedule/contract/quote, scope, validAt | approved upper bound до факта; unknown не zero | estimate заменяется/reconciles actual, не дополняет его как второй item |
| Future user payout fee | официально проверенный provider contract/quote и payout scenario | bound platform cost, учитывает fixed/variable/minimum/неизвестный результат только по contract | один logical fee на payment attempt/result согласно contract; attribution fragments sum to parent |
| Refund/correction cost | merchant/provider terms и подтверждённая exposure/case | отдельный risk bound или actual payable, не смешивать user principal с expense | linked correction IDs и actual settlements; reimbursement principal отдельно |
| Shared operating cost | supplier evidence/budget (hosting/support/accounting etc.) | actual/platform budget; per-operation allocation по approved driver | одна invoice line + assignments, не полный invoice на каждую purchase |
| Unexpected expense | owner-approved scenarios/bounds, loss data и evidence | reserve policy, не выдуманный percentage и не неизвестный cost=0 | отдельный incremental buffer, no reuse той же известной exposure |

Gross commission reduction — изменение G/revision, не processing expense.
Налоговый/accounting момент expense recognition не определяется этим проектом:
owner/accountant утверждают basis. Оценка может ограничивать admission раньше
бухгалтерского признания расхода. Нельзя признать событие заказа bank receipt.

## 3. Cost identity и жизненный цикл

В модели 3A finance_cost_items — единственный parent cost identity, его assignments
определяют attribution. Предлагаемые поля: costId/evidence namespace+line ID,
category, operation/batch links, GBP, estimate/confirmed/withheld/unpaid/paid,
amount или approved bound, policy version/validity/completeness, settlement reference.
Unknown хранится отдельно от known-zero, последнее требует evidence.

Версии оценок не уничтожаются. Actual occurrence закрывает соответствующую
estimate/exposure; budget projection использует актуальный остаток, не historical
estimate+full actual. Assignment totals для actual fee = actual fee; rounding
remainder детерминированно распределяется по утверждённой policy.
Если новая version увеличивает cost после user liability recognition, не пересчитывать
user U вниз; existing obligation сохраняется, создаётся budget/reconciliation action.

Cost count зависит от contract: rejected attempt/authorized request/settled payment
могут иметь разные charges. Не предполагать бесплатные retries или плату за каждый
retry. Unknown provider outcome не создаёт новую fee/payout identity автоматически.

## 4. Три независимые проверки

### 4.1. Per-operation economics

C_i = сумма actual confirmed costs + ещё не заменённых approved future cost bounds
+ approved shared-cost assignment + approved относимая risk provision.
Каждый элемент включён только один раз. Известный fee, уже удержанный cash, всё
равно economic cost; его cash effect не повторяется в liquidity calculation.
M_i = (G_i - HALF_UP(G_i*80%)) - C_i >0. Полнота cost model обязательна.
Future cost неизвестен и bound не утверждён → blocked_cost_unknown.
Новый capital/funding не повышает M_i. Нельзя subsidize zero/negative margin.

### 4.2. Monetary liquidity and coverage

Actual bank-backed funding lots partition: protected user principal/reserves,
payout/refund holds, confirmed cost cover, approved future fee/risk earmarks,
restricted/unallocated purpose funds и own-free остаток. Receivables, будущие
commissions, unpaid user debts и accounting income не заменяют received cash.

До new allocation нужны: покрытие user U; unpaid/estimated cash cost reserve;
допустимость source/purpose; no duplicated assignments. Already withheld fee
не добавляется снова к предстоящей оплате. Lock lot/obligation/budget versions,
проверить остаток и atomically allocate. Не чужие reserves/targeted receipts.

### 4.3. Global budget

Per-order M>0 не доказывает возможность оплатить общий overhead и все liabilities.
Budget horizon/mandatory due costs/approved bounds — owner decisions. Ledger,
funding partition и budget projection reconcile; payroll/hosting invoice не
теряется из budget из-за недостаточности per-order metric. То, что уже покрыто
assignment под payable/fee, не требует вторую такую же reserve allocation.

## 5. Минимально необходимый резерв

Не единый процент. Рекомендуемый дизайн: measured exposures с явным cash earmark.

1. User principal coverage — полная признанная liability, не расход платформы.
2. Payment-fee envelope — отдельное покрытие approved upper bounds допустимых
   пользовательских payout jobs, включая шестимесячные small-balance cases.
3. Refund/correction envelope — incremental company cash exposure по merchant
   obligations/scenarios; не повторное резервирование уже covered principal.
4. Operating envelope — known payable + approved forecast по бюджетному horizon.
5. Unexpected buffer — отдельно утверждённые конкретные сценарии/absolute bounds.

Reserve_required_own = fee envelope + incremental refund/correction exposure +
operating commitments + approved unexpected buffer, без перекрывающихся exposures.
Funding_gap = max(0, required incremental cover - admissible unassigned own cash).
User principal отдельно должен быть fully covered; его нельзя вычесть из этого gap
как available own cash. Формула не вычислима без scenario/bound/horizon evidence.

Scenario matrix нужна для перекрытий: refund до user payout может переклассифицировать
существующий covered principal; refund после completed payout может требовать новое
company cash. Protected recipient use/reserve и непокрытый debtor debt нельзя
считать немедленно recoverable bank cash. Не предполагать будущие collections.
Не суммировать взаимоисключающие scenarios как будто все произошли, но нельзя
брать только maximum одного риска, если несколько могут материализоваться вместе.
Политика агрегирования/корреляции требуется отдельно; здесь нет числа/процента.

Если upper bound нельзя доказать: новые автоматические распределения соответствующей
группы блокируются. Existing obligations не списываются, запуск payouts ждёт funding
и provider conditions. Ликвидность не создаётся внутренней фиктивной проводкой.

## 6. Варианты attribution future payout fees

| Метод | Преимущества | Риски / эффект M>0 |
| --- | --- | --- |
| Каждая новая purchase несёт полный standalone payout bound | Простой консервативный gate, не зависит от будущих покупок | Многие малые commissions blocked; aggregate estimate может быть больше реального fee; превышение — buffer, не несколько actual fees |
| Взвешенный share общего user cohort fee по user principal | Parent bound распределяется точно, поддерживает batch purchases | Cohort/closure и weights/version нужны; ещё не полученные покупки нельзя считать гарантированными; поздняя purchase меняет attribution |
| Fixed per-event quota из approved portfolio/budget model | Стабильность unit economics, forecast-friendly | Недоказанный объём превращает оценку в optimistic subsidy; не использовать без measured envelope/cash reserve и review |
| Marginal incremental fee | Учитывает добавочный variable cost | Нулевой marginal cost не устраняет fixed fee; fixed envelope должен быть явно accounted/assigned, иначе M misleading |

Рекомендация: verified user-cohort fee envelope с weights по eligible user principal,
независимым cash reserve и deterministic cost assignment. Но cohort policy должен
работать и для единственной покупки до age trigger. До approval/доказанного bound —
block, не применять optimistic batch forecast. Standalone bound можно выбрать как
временную owner-approved conservative альтернативу, без реальных тарифов здесь.

Cohort должен принадлежать текущему владельцу и покрываемому payment purpose;
transfer меняет будущего payer/recipient context, но не originalConfirmedAt.
Правило reallocation estimate после transfer требует policy: фактическая выплата
может объединить origins разных commissions. Нельзя сбросить age или потерять fee
reserve. Actual provider fee записывается однажды на job/charge identity; attribution
в cost assignments, а не несколько независимых fee events.

## 7. Общие operating costs

Варианты: (A) direct drivers по подтверждённому использованию; (B) approved
per-operation allocation fixed costs на forecast volume; (C) периодный platform
budget отдельно от per-operation gross margin.
A лучше auditable, но не все fixed costs измеримы; B даёт full unit economics,
но optimistic forecast volume занижает C; C показывает liquidity, но не доказывает
full attributable M, если часть overhead действительно относится к operation.
Рекомендация: прямые расходы A, реально shared — owner-approved conservative B,
и обязательный global budget C без повторного включения тех же costs. Ни распределение
«все расходы одной purchase», ни «overhead всегда zero» не назначаются автоматически.

## 8. Payout eligibility и fee budget

До job claim: подтверждённые доступные средства, no debt, protected reserves исключены,
GBP/GB/provider/security, £10 trigger либо age six calendar months. Проверить quote
и platform fee coverage; user principal не уменьшается. Для ОБОИХ trigger
amount <= full fee → deferred, не executed и не liability write-off. Область фильтра окончательно утверждена для обоих trigger; период subsequent
re-evaluation и тарифы не назначены.

Защита concurrency: user/obligations/fee lots/budget locks, one stable claim identity
независимо от двух trigger reasons. Hold funds до достоверного provider outcome.
Unknown → reconcile original transfer, не повторить как новый. Provider action required
→ waiting, не bypass. По невозможной выплате подтверждённая сумма остаётся бессрочно.
Age scheduling — calendar months; release/transfer не новая confirmation.

## 9. Контрольные сценарии

| Сценарий | Допуск и действие |
| --- | --- |
| G £10, all C £1 | U £8, P £2, M £1; только economic pass, затем cash/budget locks |
| G £10, all C £2 | M £0 → blocked, user 80% не уменьшать |
| G £10, all C £3 | M -£1 → blocked даже с own-free cash |
| G очень мал | U/P HALF_UP; если P=0 или C>=P, blocked; не произвольный minimum purchase |
| Несколько purchases до £10 user funds | Каждая M>0 по approved cost assignment; один payout envelope; не рассчитывать на будущий receipt без evidence |
| Six-month amount <£10 | amount>fee/provider minimum/no debt/funding → full principal payout; иначе defer liability |
| Fee tariff вырос | Новые операции re-evaluate по новой версии; existing user claims не урезать, funding gap/reconcile |
| Partial/full return | confirmed correction distinct from fee, preserved journal; existing liabilities защищены; refund cash exposure по stage и protected origins |
| Недостаток own-free cash | cash/budget block даже при M>0; no borrowing user reserves |
| Costs недостоверны | block unknown; не C=0 |

£1/£2/£3 в примерах — полные относимые расходы, не только processing fee с
игнорированием future payout. Если £1 processing плюс неизвестный future cost,
пример НЕ даёт pass до модели полного C. Late adjustments после распределения
остаются reconciliation-only в текущем согласованном scope; automatic clawback
не внедряется этим проектом.

## 10. Решения владельца

| Решение | Варианты и последствия | Рекомендация на утверждение |
| --- | --- | --- |
| Future payout allocation | standalone bound: строгий/меньше throughput; cohort weighted: эффективнее/нужна финализация; forecast quota: model risk | Verified cohort envelope + cash cover; пока нет policy — block |
| Минимальный safety reserve | fixed arbitrary % не доказан; scenario-based absolute bound требует evidence; неизвестный risk без bound | Evidence/scenario-based incremental reserve, отдельный owner-approved aggregation; no chosen number |
| Shared overhead | direct driver; forecast per-order; global-only | direct + conservative shared policy + global budget, de-duplicate |
| Estimate review | event-triggered либо period-only; period-only может пропустить tariff change | обязательно при tariff/quote/source changes плюс утверждённый periodic cadence; срок не назначен |
| Funding insufficiency | stop new allocations; ожидать confirmed own funding; нарушить protected funds — запрещено | stop/reconcile новых операций; existing claims retained, payable jobs defer safely |
| Fee comparison scope | УТВЕРЖДЕНО B64: оба triggers, principal>full fee | Решение закрыто; fee отдельно платформы, все coverage/budget gates обязательны |
| Calendar/account behavior | timezone/end-month; age vs activity; transfer fee context | отдельное решение Q14, не фиксированные days |
| Refund risk bound | documented case obligations vs approved scenario estimates | действующие обязательства cover fully; future bound по validated exposure policy |

Отдельно нужен accountant/legal approval recognition expenses/reserves и UK rules;
данный документ технический проект, не заключение о регуляторной пригодности.

## 11. Минимальные будущие структуры/тесты

Переиспользовать 3A cost_items/cost_assignments/funding_lots/coverage_allocations/
operation_events. Добавить versioned CostPolicy/FeeQuote/ExposureScenario/Budget
records только по необходимости; не создавать второй funding ledger или дублирующие
actual costs. Cash-bounds и policy IDs сохраняются в immutable admission decision.

Unit: penny exact cost allocation и deterministic residual; known-zero/unknown;
C completeness, M=0, estimate replaced not added; standalone/cohort bounds.
Isolated integration: concurrent budget/lot claim, protected purpose exclusion,
fee hold vs payout/return, same provider charge once, transaction rollback,
rate-change re-evaluation, existing-liability preservation, duplicate age/£10 triggers.
Security: no arbitrary client-supplied tariff/evidence approval; provider secrets
не в payload; budget permissions separate. No real provider APIs on этой фазе.

## 12. Этапы и контроль

1. Утвердить §10, перечень costs и evidence/completeness; выбрать policies.
2. Проектировать validators/projections/contracts без реальных начислений.
3. Additive finance migration/isolated tests отдельным scope после approval.
4. Receipt/commission admission + pending liability с full costs/cash/budget gates.
5. Future payouts/providers/legal readiness — следующий отдельный этап.

Создан только новый документ; 3A и BUSINESS_SPEC не изменены. Код/миграции/tests,
main и isolated finance DB, Docker/volumes/UI/backups не менялись. Tests/build,
Git commit/push/fetch/pull не запускались. HEAD/status/index сохранены.


## 13. Согласование с окончательным payout gate B64–B65

Both trigger reasons работают через один atomic eligible/claim workflow; user
liability и original date бессрочно сохраняются при defer. Confirmed own-free
fee funds нельзя заменить user principal/protected reserve. Unknown fee/status
не принимается за zero/failure. Subsequent check предусмотрен без произвольно
назначенного расписания; trigger не создаёт новую confirmation дату.
Cost completeness/M>0 проверяет новые purchases; payout gate не прекращает
existing legal obligation. Нельзя списать user деньги ради сохранения margin.
Периодичность, tariff evidence, quotes/bounds и reserve sizes остаются решениями
владельца/provider; ни одно число этим обновлением не назначено.
