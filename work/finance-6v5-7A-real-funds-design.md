# Cashback+ — 6В.5.7-А: контролируемые реальные назначения средств

Дата: 14.10.2026. **ПРОЕКТ НА УТВЕРЖДЕНИЕ. Только архитектура и документация.**
Никакие начисления, освобождение средств, новые миграции или платежи не разрешаются.

## 1. Основание и пределы проекта

Изучены BUSINESS_SPEC_6B_FINAL.md, проекты 3A, 3B, 3B1 и 6В.5.6-А, текущие receipts,
evidence, coverage, finance accounts/journals/postings и outbox. Последующие решения
владельца о полном синтетическом покрытии, мандатах и historical replay имеют приоритет
над открытыми вариантами старого проектного документа.

Уже реализованное: GBP bigint/точное округление; receipt-only проводка; один restricted
lot на receipt; active-manager evidence с revoke/independent restore; синтетический
full-cover reserve, cumulative mandate/lot limits и исторический replay с blocked flag.
118 unit и 22 PostgreSQL сценария предыдущего этапа не доказывают работоспособность
реальных назначений. Тесты/сборка в данном проектном этапе не запускались.

Сейчас coverage SQL CHECK и типы разрешают только synthetic_test_coverage, created →
reserved и неизменяемые held allocations. Нет release, реального cost/budget/liability
workflow, bank settlement/impairment или live authority. Эти свойства нельзя считать
готовым контролем production ликвидности.

Метки: **УТВЕРЖДЕНО** — явное правило владельца; **ПРОЕКТ** — предлагаемый способ;
**ОТКРЫТО** — решение владельца/accountant/ответственного за договорные условия.
Документ описывает необходимые юридические основания в виде проверяемых договорных
фактов, но не устанавливает их наличие и не заключает о применимости конкретного
британского бухгалтерского/правового режима. Реальные договоры, налоги и accounting
policy не предоставлены; они необходимы перед бухгалтерской реализацией/запуском.

## 2. Четыре отдельные границы

1. **Bank receipt:** компания фактически получила GBP. Только Dr company_bank_cash /
   Cr unallocated_received_funds. Bank proof не доказывает источник дохода/ownership.
2. **Source classification:** что означает receipt или его доказанная часть, какой
   договор/partner event/корректировка его объясняет. Сама категория не начисляет денег.
3. **Recognition:** по согласованному основанию признаются доход, cost/payable и/или
   пользовательское обязательство; отдельный state от journal.sealed и outbox delivery.
4. **Coverage/purpose:** конкретные cash pennies защищают конкретную цель. Не создают
   второй доход, актив или liability и не дают самостоятельного payout разрешения.

Предлагаемый поток: verified receipt → classified/unresolved portions → source event
и commission/cost reconciliation → applicable economics + coverage + budget gates →
recognition_pending_conditions + protected coverage → future availability/payout.
До всех условий автоматического признания неизвестное остаётся на сверке/restricted.

Важно: юридическое обязательство может уже существовать независимо от внутреннего
gate. Не превращать blocked application workflow в доказательство отсутствия долга.
Такие факты направляются в mandatory recognition/reconciliation, сохраняются и
урегулируются; добровольное создание новых непокрытых обязательств блокируется.

## 3. Каталог источников и доказательств

| Источник | Необходимое юридическое/экономическое основание | Подтверждение и признание |
| --- | --- | --- |
| Покупательская комиссия | Договор партнёра, qualifying order/category, attribution и exclusions, confirmed commission revision, договорная обязанность перед пользователем | Bank coverage отдельно от order notification; gross commission/withheld fees подтверждены и сверены. Утверждённый split 80/20. User share после достаточного покрытия/проверок — pending_return_window; пока недоступна |
| Добровольная вознаграждаемая реклама | Договор об оплачиваемом квалифицированном рекламном событии и условия пользовательского вознаграждения | Partner-confirmed payable event и фактический receipt. Split 80/20; browser timer/view/click без подтверждения не основание. Доступность и возможные clawbacks по утверждённой source policy |
| Research referral | Договор именно о вознаграждении платформе за привлечение участника, оплачиваемый критерий, идентичность referral и eligible пользователя | Partner-confirmed paid/eligible referral + receipt/matching. Split 50/50. Простая регистрация без partner confirmation не начисляет reward; не требовать выдуманный этап исследования, если оплачиваемый критерий договора другой |
| Обычная реклама сайта | Договор о рекламном доходе платформы, проверенный settlement/report period и adjustments | Confirmed and received source amount, 0/100. Пользовательского обязательства нет; company profit/free cash всё равно не равны receipt |
| Возврат/корректировка | Исходная operation/receipt/commission, договорное требование или исправление, направление actual movement, amount/reason/revision | Не новый произвольный revenue type для split. Новый idempotent event/case; accounting treatment зависит от того, признана ли исходная liability/income и был ли платёж |
| Собственные средства | Подтверждённое право компании и назначение: документированный capital/equity contribution, unrestricted retained cash либо другое approved основание | Capital не revenue. Loan создаёт отдельное обязательство и ограничения, не default own-free. Возврат собственных средств/ошибочного debit восстанавливает правильный origin, не новый доход |

Все решения содержат source policy/version, external namespace/event ID, bank/canonical
operation и evidence references, recipient/domain references, сумму/валюту/время/версию,
qualified status и условия возврата. Нельзя считать назначение платежа или название
плательщика полным доказательством. Доверенный source confirmer отдельно от bank verifier.

GBP/UK-only сохраняются. Иностранные программы/FX/мультивалютность не проектируются
как разрешённая текущая функция. Прямое вознаграждение человеку от исследовательской
организации не автоматически referral income Cashback+ и не автоматически база 50/50.

## 4. Основание пользовательского обязательства и дохода

ПРОЕКТ source policy должна отдельно задавать:

- событие возникновения договорного/юридического требования;
- момент внутреннего financial recognition и подтверждение фактического получения;
- условия доступности user amount, возвратов, partner reversals и finalization;
- допустимую gross/net базу, точность суммы и обработку fractional external totals;
- основания признания platform income/cost/expense, не только названия банковской строки.

Для покупки утверждены G=confirmed gross commission до processing expenses,
U=HALF_UP(G×80%), P=G−U. После документального достаточного покрытия и проверок U
признаётся pending_return_window; освобождение требует полного approved return policy.
Универсальный срок возврата не задан. Receipt, user recognition и availability — три
разных момента; шестимесячный payout trigger не отменяет return/eligibility restrictions.

Для rewarded ads и research referral проценты утверждены, но точные критерии payable
event/finality и общая денежная база при удержаниях/налогах требуют договора/policy.
Не переносить автоматически purchase return window или gross processing rules на них.
Рекомендация на утверждение: отдельный source_pending_conditions до выполненных
условий, затем availability. Названия состояния технические, срока или критерия не вводят.

Platform share recognition только once, после source confirmation и реального receipt
по утверждённому основанию. При passive ads user share=0; это не снимает cost/budget/
cash classification требований. Доход может быть признан, но остающийся cash всё ещё
защищает costs/payables/reserves; нельзя считать P сразу собственными свободными funds.

OriginalConfirmedAt user amounts должен сохраняться при transfer/release/defer; он
не просто receipt.createdAt, bank date или research signup time. Его точное source
событие требует явной policy, включая pending availability. GBP-суммы не сгорают.
Согласованные долги, origin lineage, ответственность отправителя и protected recipient
reserves сохраняются; source classification не обходит их.

## 5. Many-to-many matching и реальный purpose grant

ПРОЕКТ reuse модели 3A:

- Source claims/commission revisions имеют независимую identity от банковской операции.
- Receipt-source links объясняют, какие части cash/withheld expenses относятся к каким
  source claims. Один receipt объясняет несколько commissions; одна commission может
  иметь несколько receipts. Сумма cash links не больше actual receipt.
- Unknown discrepancy/неподтверждённое удержание блокируют distribution, а не становятся
  расходом 0 или arbitrarily corrected G. Processing expense и commission revision различны.
- Real purpose grant — проверенная часть origin/лимит/beneficiary/target restrictions,
  source classification revision и authority. Это не synthetic test mandate.

Необходима отдельная доверенная RealFundsAuthority с default deny. Она подтверждает
classification basis/полномочия, но не заменяет existing bank verifier. Synthetic
CoverageMandateProvider, роли evidence и его grants не дают real allocation permissions.
Нельзя расширить string union purpose и этим включить реальное распределение.

Старые synthetic targets/reservations остаются синтетическими и не импортируются как
обязательства или production evidence. Реальная система начинает с чистого реестра;
демонстрационные user/bonus данные не мигрируются. Очистка любых данных/томов требует
отдельного разрешения и проверки окружения, в этом проекте не предлагается.

## 6. Контроль маржи, ликвидности и бюджета

УТВЕРЖДЕНО B61/B66 для новых экономических операций всех четырёх источников:

```text
G = подтверждённая gross commission в пенсах
r = 80 для shopping_cashback/rewarded_ads, 50 для research_referral, 0 для passive_ads
U = HALF_UP(G × r / 100)
P = G − U
C = полные относимые costs + ещё не заменённые утверждённые future estimates
M = P − C
новый экономический допуск только M > 0
```

Zero/negative M или недостоверный C → block/reconciliation. User U не уменьшается.
Own cash не делает negative operation прибыльной. Независимы и обязательны:
полное допустимое cash coverage, отсутствие double reservation, cost/fee cover и
global budget. Документированное received cash не заменяется receivable, должником
или прогнозом комиссий. P/revenue не доказательство own-free.

Costs: already withheld, confirmed unpaid, expected processing, future user payouts,
refund/correction exposure, common operating costs и approved unforeseen risk bounds.
Один parent cost identity; assignments суммируются без дублирования. Estimate заменяется
actual charge, а не прибавляется вторым expense. Withheld expense уже уменьшил cash:
не удерживать его второй раз как future payable.

B64–B65: £10 и 6 calendar months triggers имеют одинаковый gate — principal>full fee,
fee отдельно платформы из confirmed own-free, no debt/protected exclusions/provider/
security/principal cover/budget. При невозможности user liability/date сохраняются.
Тарифы, cohort fee attribution, reserve bounds/horizon и recheck период не определяются здесь.

### Единый gate, включая обычную рекламу: B66

Владелец утвердил M>0 для shopping_cashback (80/20), rewarded_ads (80/20),
research_referral (50/50), passive_ads (0/100). В passive_ads U=0 и M=G-C;
отсутствие пользовательской доли не освобождает от проверки прибыльности.
Варианты допуска M>=0 и отдельного более слабого gate для рекламы больше не открыты.

Новый distribution либо новое economic obligation допускаются только одновременно
при M>0, достоверности всех существенных costs/estimates, confirmed cash coverage,
no double reservation и соблюдении budget. M<=0/unknown существенный cost — block.
Не менять user share и не считать неизвестный overhead/будущую fee нулём.

Остаётся выбрать доказанную единицу контроля: payable event/settlement cohort/campaign
и approved cost attribution/aggregation по конкретному источнику. Это детали расчёта,
а не право отменить единый M>0. Нельзя присвоить каждой строке полный campaign cost
повторно или размыть отрицательную операцию недоказанным future income.

Различать admission новой экономической операции и отражение **уже совершившегося**
факта. Отрицательная маржа сама по себе не блокирует регистрацию фактического bank
receipt или обязательные бухгалтерские корректировки. Existing legal obligations
сохраняются; их нельзя аннулировать/уменьшить внутренним gate. Такие факты отражаются
по достоверному approved accounting основанию и идут на reconciliation при дефиците,
без фиктивного свободного покрытия, новой прибыли или переписывания original journal.
B64–B65 payout gates и бессрочность user funds остаются прежними.

## 7. План счетов и совместимость receipt-only

| Счёт | Роль / сторона | Статус |
| --- | --- | --- |
| company_bank_cash | Debit cash asset по actual movements | Реализован |
| unallocated_received_funds | Credit suspense до доказанной классификации | Реализован |
| source_pending_classification | Credit amount по approved recognition basis | Проект; не считать gross здесь cash |
| user_pending_return_window / source_pending_conditions | Credit user liability, пока недоступна | Проект |
| user_available / protected_reserve / payout_hold | Credit subaccounts одной liability, внутренние переносы | Проект |
| platform_income | Credit once-only доля | Kind существует, real source posting не активирован |
| processing_expense / payment_expense | Debit actual platform expenses | Проект новых kinds/constraints |
| cost_payable / merchant_payable | Credit legal payables | Проект |
| capital_equity / loan_payable | Credit собственное финансирование либо долг по договору | Проект, не revenue |
| correction/deficit accounts | По отдельно утверждённому accounting основанию | Открыто |

Наличие старых user_gbp/bonus_liability/reserved kinds не доказывает корректные
real availability semantics. Не использовать clearing как фиктивное покрытие или
универсальный expense/equity account. Будущие account kinds/normal-side checks только
отдельными finance migrations, без изменения baseline или существующих business tables.

Funding purpose/coverage — аналитика происхождения и ограничения cash, а не второй
бухгалтерский баланс. Ledger единственная бухгалтерская истина; source claims, costs
и obligations — независимые domain facts с проверяемыми journal links, не cash копии.

## 8. Примеры проводок — предложения до accounting approval

Во всех примерах GBP; финальные amounts — целые пенсы. **Утверждена сейчас только
receipt-only запись. Следующие reclassification/recognition записи — кандидаты**,
не выполняются и не назначают юридический/налоговый момент автоматически.

### 8.1. Без удержаний, commission £10

Actual receipt, текущий контур:

```text
Dr company_bank_cash              £10
Cr unallocated_received_funds      £10
```

После confirmed source, legal basis и всех gates, предлагаемый once-only recognition:

```text
Dr unallocated_received_funds      £10
Cr user_pending_return_window       £8
Cr platform_income                 £2
```

Cash не увеличивается повторно. Coverage £8 user principal; platform £2 ещё не
own-free без costs/budget checks. Для rewarded ads при одобренной такой же базе
аналогично 8/2, но user state по source conditions. Research referral 5/5, passive
0/10 (нет user liability), только после соответствующей approved source policy.

### 8.2. Gross £10, документированное processing withholding £1, net receipt £9

Receipt: Dr bank £9 / Cr unallocated £9. Возможный комбинированный settlement/
recognition bridge **при отсутствии уже признанного receivable/expense**:

```text
Dr unallocated_received_funds       £9
Dr processing_expense               £1
Cr user_pending_return_window       £8
Cr platform_income                 £2
```

Balanced £10/£10; bank остаётся £9, net platform result £1. Не делать новый bank
receipt на withholding. Если receivable/expense уже признаны в другом approved
workflow, этот bridge применять нельзя: повторит expense/income. Нужна одна policy
и linkage к оригинальным journals, не две параллельные схемы.

Когда полные C=£1, M=£1 — экономическая проверка пройдена, но всё ещё нужны cash/
budget/future fee bounds. Пример C не означает, что неизвестные будущие fees равны нулю.
При C=£2, M=0, либо C=£3, M=-£1, новое purchase distribution blocked. Реальные net
receipts £8/£7 сохраняются на сверке; признанные/понесённые costs и existing liabilities
не скрываются. Если обязательство уже возникло, its mandatory recognition и funding
gap требуют отдельной согласованной записи, а не отмены user share.

### 8.3. Другие операции

| Событие | Accounting candidate / важное условие |
| --- | --- |
| Confirmed unpaid platform cost | Dr expense / Cr cost_payable; позже payment Dr payable / Cr bank, expense не повторяется |
| Future fee reserve | Coverage/budget metadata; не Dr actual expense только за estimate |
| Выполнение availability условий | Dr user_pending / Cr user_available; не new bank/income; coverage сохраняется |
| User payout hold | Dr user_available / Cr payout_hold; та же principal allocation rebind, не второй reserve |
| Подтверждённая payout execution | Dr payout_hold / Cr bank principal; fee Dr payment_expense / Cr bank либо settlement уже признанного payable. Нельзя повторять expense |
| Capital receipt | После receipt-only: Dr unallocated / Cr capital_equity по verified funding documents; не platform revenue |
| Loan receipt | Dr unallocated / Cr loan_payable по договору; restrictions/repayment cover отдельно, не default free |
| Возврат нераспределённого receipt | Dr unallocated / Cr bank на подтвердившийся refundable amount, если ещё есть соответствующие balances и legal basis |
| User debt offset | Separate balanced debtor/liability/merchant obligation reclassification; не bank transfer/new income, точная policy вне этого проекта |

Возврат после распределения/выплаты не имеет универсальной обратной проводки:
нужны original income/user claim/cash status, merchant liability и approved correction
policy. Не проводить proposed rows средствами чужих liabilities/защищённых резервов.

## 9. Реальные назначения и безопасное освобождение

Предлагаемые отдельные purpose permissions: matched source distribution, user liability
coverage, confirmed cost/payable, payout principal/fee, merchant obligation и documented
own-funds use. Действуют лимит, beneficiary/domain scope, source/cost/budget versions
и evidence control. Не указывать free=true в client command и не выдавать права evidence
roles автоматически. Синтетический мандат не один из real purposes.

| Основание | Что разрешено при согласованной policy | Что сохраняется |
| --- | --- | --- |
| Отмена proposal до возникновения обязательства | Idempotent cancellation и release именно proposal coverage в прежний restricted/purpose pool | Origin/evidence/history; не превращать остаток в прибыль |
| Корректировка суммы до recognition | Новая подтверждённая source revision; пересчитать costs/gates и excess cover атомарно | Старые revisions и canonical identity |
| Корректировка после recognition | Отдельная correction case/проводка; release только реально уменьшенного due по legal основанию либо replacement/settlement | Нельзя односторонне снизить user liability ради M/cash |
| Возврат партнёру | Cover retarget на merchant payable/payment hold; после trusted execution — cash consumption | Это не release для повторного расходования тех же денег |
| Банковское сторно | New confirmed debit event + impairment/correction; блокировать affected origin, установить funding gap | Original receipt/lot/journal и все claims |
| Завершённая payout | Principal allocation становится settled/external consumed; unused fee bound release только после confirmed actual charges | Liability discharge подтверждён отдельно; consumed pennies не available again |
| Ошибочное reservation | Documented error, separate repair event; exact fragment release/rebind под всеми locks; existing claim получает replacement или остаётся в case | Нет DELETE allocation и мгновенного незащищённого окна |
| Только evidence revoke | **Никакого release**: historical held coverage blocked | Лимит занят, user/seller obligations не прекращаются |

При provider outcome_unknown не освобождать hold по timeout/новому idempotency key.
Сначала сверить оригинальный платёж/charge; event outbox delivery не bank confirmation.
Release не отменяет protected recipient reserve и не восстанавливает applied бонусы
в available при purchase clawback: утверждённые debt правила остаются самостоятельными.

## 10. Единый coverage lifecycle вместо второй системы резервов

Текущие allocations immutable held и capacity=sum всех held исходных rows. Перед real
release/spend эту формулу необходимо заменить общим проверяемым lifecycle engine.
Нельзя создать отдельный real allocator, который игнорирует synthetic holds или
проводит один и тот же cash вне общей capacity.

Рекомендация: сохранить original allocations/reservations как immutable origins,
добавить append-only coverage transitions/fragments и одну восстановимую current
projection на lot/target. Held→rebound/settled/released/affected transitions с версией,
reason/basis и conservation. Все synthetic и real branches используют один capacity
validator; original synthetic purpose и no-release policy остаются закрытыми.
Не retrofit старые test rows как real grants; synthetic context не production basis.

Schema CHECK/FK, сейчас жёстко synthetic, не ослаблять общим allow-any-kind. Будущая
additive migration должна иметь discriminated real/synthetic branches, trusted real
purpose reference и строгие условные constraints; соответствующие services не получают
чужие действия. Точный schema/upgrade protocol требуется отдельно до реализации.

Internal reassign не bank spend: user coverage → payout hold переносит ту же principal
allocation. Parent/child amounts не суммируются как два самостоятельных резерва. Fee —
отдельный cost assignment из own funds. Released cover возвращается прежнему purpose,
не default platform-income. Bank settlements изменяют actual remaining capacity один раз.

## 11. Блокировка, нехватка, потеря и существующий долг

| Состояние | Cash/coverage смысл | Действие |
| --- | --- | --- |
| Временный trust/control hold | Cash может оставаться, но недоступен новым операциям | Сохранить nominal allocations; проверить восстановление independently |
| Coverage shortage | Требуемый amount больше допустимой свободной подтверждённой capacity | Stop new voluntary obligations; funding/reconciliation, не заимствование protected cash |
| Подтверждённая потеря/возврат cash | Реальный bank debit/impairment уже произошёл | Отдельный immutable confirmed event и approved correction accounting; не скрыть deficit |
| Existing legal obligation | Долг платформы существует независимо от availability/coverage | Сохранить amounts/origin/date; settlement plan и gap, без write-off по M |

Effective trusted coverage может стать 0 при revoke, но nominal held не становится
свободным. Restore не снимает другие purpose/payment ограничения. Реальный reversal
после предыдущего payout может создать gap сверх оставшейся original lot capacity:
не subtract одни и те же pennies как original spend и ещё раз как повторное доступное
расходование. Нужна отдельная incident/loss attribution policy и сверка по bank scope.

Healthy новые assignments требуют exact capacity без отрицательного available.
Existing impaired claims нельзя запрещать записать CHECK «nominal claims всегда ≤ cash»:
иначе система скроет реальную потерю. Impaired history/gap сохраняется с evidence,
current trusted capacity для новых operations закрыта. Реальный overdraft/negative bank
fact не моделируется текущим nonnegative company_bank_cash полностью: отдельное
accounting решение, без отключения guard или фиктивного receipt.

Будущие должниковы поступления сначала покрывают разрешённый debt, не payout threshold;
зачёт без повторного income. Free origin-linked recipient bonus может покрывать debt
отправителя по approved rules, reserved/used recipient amounts защищены. Debt receivable
и ожидаемые collections не counted cash. Платформа не может гасить расходы чужим principal.

## 12. События, outbox и аудит

Предлагаемые typed domain events, schemaVersion=1 как будущие новые контракты:

| Event | Минимальные данные / значение |
| --- | --- |
| finance.funds.classified | classificationId/revision, receipt/lot portions, source kind, basis/policy refs |
| finance.obligation.recognized | obligationId/version, beneficiary opaque ref, GBP amount, source operation, recognition journal ref |
| finance.coverage.assigned | target/allocation refs, exact pennies, permission/source/control versions |
| finance.funds.blocked | origin/operation refs, reasonCode, state/version, связанные claims; не новый debit |
| finance.correction.recorded | correctionId/origin/source revision, confirmed/proposed status, reason/basis; не implicit posting |
| finance.coverage.released | exact original fragments, amount, legal/release reason, target version; не новая прибыль |
| finance.coverage.settled | confirmed payment/bank movement refs, disjoint consumed amounts; отличается от release |

Каждое событие имеет eventId, stable event idempotency key, root command key,
operationId, createdAt, type/version, payload hash и aggregate version. Несколько
событий одной команды получают разные deterministic semantic keys; root command не
переиспользуется как единственный UNIQUE outbox key для всех событий. Payload строится
сервером из committed-command facts (до commit provisional), не принимает arbitrary JSON.
Секреты/банковские документы/реквизиты/избыточная PII не включаются.

Текущий finance_outbox требует journalId UNIQUE/FK и ledger payload; receipt event
сохранить без изменения смысла. **Рекомендация** — один outbox с явной category
ledger/domain: ledger branch сохраняет strict finance.journal.posted v1 и journalId
non-null/unique, domain branch journalId=NULL и отдельный optional relatedJournalId
FK без uniqueness для связей. Условные constraints и immutability/insert guards
проверяют каждый branch; текущий FinanceEventsService остаётся strict ledger writer.
Новые DomainEventsService/validation и additive migration требуют отдельного approval.

Не создавать dummy balanced journal для no-money classification/block/release.
Не дублировать одну deliverable domain fact в другом outbox. Ledger — единственный
источник бухгалтерского движения; outbox его не заменяет, funds domain records не
новый spendable balance. At-least-once delivery/idempotent consumers, no automatic
payment от записи internal fact. Worker/delivery/payments ещё отдельные этапы.

Successful decisions/domain/coverage/journal/outbox атомарны. Failed command rollback
не оставляет financial audit успеха; security refusal log отдельно после rollback,
без nested financial commit. Аудит approvals/source/policy/roles, доступа к evidence,
releases и corrections immutable/versioned, с независимой защитой от DBA обхода.

## 13. Полномочия и транзакционные locks

ПРОЕКТ новых действий trusted authorization: classify_source, confirm_payable_event,
approve_cost_policy, assign_real_purpose, recognize_obligation, release_coverage,
record_correction, confirm_external_settlement. Роли/делегирование выбрать владельцу.
Evidence submitter/reviewer/controller сохраняют свои утверждённые полномочия и не
получают реальные financial actions автоматически. Reference/role string не authority.
Настройка sources/policies и выдача real grants аудируются отдельно от команды расхода.
Production adapters default deny; никаких реальных bank calls в SQL transaction.

Единый предлагаемый порядок:

1. Existing authorization gate 726405, trusted grants/policy version checks.
2. Все account scopes sorted (726404).
3. Все canonical bank identities sorted (726403), operation rows sorted; after-lock
   reread evidence, включая revoke и actual scope mapping.
4. Все lot/funding_control rows sorted, purpose/mandate rows sorted.
5. Source business identity guards и commission/cost/budget rows в фиксированном
   порядке; obligations/coverage targets, allocations/transitions sorted.
6. Все journal event keys sorted (726402), затем sorted ledger accounts.
7. Re-evaluate legal/cost/margin/capacity/budget/target versions; append domain state/
   transitions, необходимые ledger entries и typed outbox; outer commit.

Lock set заранее известен. Изменился mapping/версия и нужен новый lower-order lock —
abort/replan, не дозахват после accounts. Missing rows требуют parent/advisory guard
и unique constraints, FOR UPDATE отсутствующей записи не достаточно. Current per-lot
evidence helper применяется только после полного multi-scope prelock collector.
Текущая coarse authorization сериализация сохраняется для первого этапа; оптимизацию
не заявлять без race tests. Все real paths закрывают generic ledger/SQL bypass.

Revoke и classification/coverage того же origin сериализуются: revoke-first → refused
new use; assignment-first → сохранённый blocked historical cover. Restore не release.
Coverage replay возвращает original result, replay=true/current blocked; receipt replay
на revoked по-прежнему BANK_EVIDENCE_BLOCKED. Новый release/recognition replay contract
описать отдельно: historical success не разрешение повторить движение или снять hold.

## 14. PostgreSQL и идемпотентность

Один business source event/revision имеет canonical namespace/ID, независимо от нового
request key. UNIQUE source operation + decision/recognition identity, FK origin links,
immutable originals и запрет CASCADE удаления obligations. Request key + canonical
material hash, stable UUID/amount/field/fragments ordering; JSONB order не влияет.

Positive GBP pennies, amounts в bigint и aggregate sums numeric. Parent lot/target/
mandate/budget locks + deferred cross-row conservation; row CHECK/SELECT SUM сами
не защищают write skew. Новые grants/limits не обходят общую cash capacity. Confirmed
external movement имеет unique execution identity; unknown status не второй payment.

Одна active EntityManager transaction: финансовые методы не создают независимый commit.
Deadlock/serialization failure откатывает всю команду и допустимый повтор с тем же key.
Replay не новый journal/outbox/recognition. Документ/UUID/hash недостаточны для bank
или source proof. DB permissions должны ограничить application roles; superuser может
обойти constraints, поэтому независимый audit/production security review обязательны.

## 15. Минимальные сущности и будущие миграции

Reuse 3A вместо новой конкурирующей модели:

- finance_source_policies/verified classification revisions и source operation records;
- finance_partner_commissions или обобщённые source claims с discriminated kinds;
- finance_receipt_allocations для many-to-many source matching, не cash reservation;
- finance_cost_items/cost_assignments + budget/control decision versions;
- finance_obligations с journal links, origin/confirmation/availability restrictions;
- real purpose permissions и единый coverage transitions/control engine;
- один расширенный typed outbox для domain facts, сохраняя ledger branch.

Source claim, legal obligation, cash capacity и payout state не смешиваются. Real
target ссылается на obligation/cost/job, а не хранит ещё один independently editable due.
User ownership/provenance slices нужны отдельному bonus/debt/availability этапу.

Каждая schema эволюция — отдельная finance migration с isolated DB identity preflight;
существующие пять baseline migrations не редактировать. Нет production/test backfill
approval и нет переноса demo finance history. Old bonus_transfers conflict не исправлять
попутно. Не подключать FinanceModule и не применять DDL к основной базе.

## 16. Контрольные сценарии будущих тестов

| Сценарий | Обязательный результат |
| --- | --- |
| Receipt без source basis | Restricted/unclassified, no user/platform recognition |
| Partner order/report без денег | Source pending/case, no fictional bank receipt |
| Research signup без paid confirmation | No referral accrual |
| Paid referral 50/50, direct study payment | Только qualifying referral делится 50/50; другой источник отдельно |
| Одна комиссия/несколько receipts, receipt/несколько commissions | Exact links/coverage, no double cash/source recognition |
| Покупка £10, C £1/£2/£3 или unknown | Только M>0 плюс остальные gates; zero/negative/unknown block новых operations |
| Все четыре источника: M<0 / M=0 / M>0 / unknown C | Первый/второй/unknown блокируют новое распределение или новое economic obligation; M>0 ещё требует coverage/no-double-reserve/budget |
| Passive ads без approved cost unit/aggregation | M>0 обязателен; cash facts сохранены, automated distribution ждёт достоверного C; no user liability |
| Withheld vs unpaid vs future estimate | Одна expense/charge identity, net bank не gross, no double fee reserve |
| Два recognition/assignments на один lot/source | Unique identity + locks, одна liability/coverage, точные суммы |
| Revoke-first / assignment-first / restore | Refusal либо historical blocked cover; restore не free/release |
| Cancel proposal vs existing liability | Release proposal допустим по policy; liability не прекращается только coverage action |
| Partial correction/return после payout | Original immutable, separate case/posting, gap retained, protected amounts не изымаются |
| Completed/failed/unknown payout и fee | Consumed cash не released capacity; unknown reconciliation, fee платформы отдельно |
| Errors по стадиям | Полный rollback domain/coverage/ledger/outbox; retry не удваивает |
| Domain outbox vs ledger v1 | No dummy journal; strict branch schemas/FKs/immutability и existing replay compatibility |
| Own capital/loan/unrelated funds | No income по capital, loan restrictions preserved; protected funds не own-free |
| Multi-order purchase/bonus lineage | Комиссии всех eligible orders 80/20; бонус однажды к выбранному самому дорогому по approved metric, не дублировать по позициям |
| Debt/transfer/age/payout triggers | Debt priority, protected recipient reserves, original dates, no expiry, £10/6-month gates intact |

Для PostgreSQL — несколько соединений, реальные lock barriers и committed visibility,
immutable history/aggregate constraints, projection rebuild и сравнение bank-backed
capacity с cash ledger. Synthetic tests не доказывают реальное contract compliance,
банковские возможности или correctness неподтверждённой accounting policy.

## 17. Решения владельца до соответствующих этапов

1. Source policy catalogue, документы/qualified payable events для purchases, ads,
   referral/passive. Registration/просмотр сами по себе не approved paid event.
2. Момент юридического user claim, recognition, originalConfirmedAt и availability;
   конкретные return/attribution/reporting windows, multi-order metric/ties отдельно.
3. Gross/net/withholdings/налоги/fractional amounts basis для не-purchase sources;
   purchase gross 80/20 не менять.
4. Accounting recognition policy и конкретные новые accounts/entries, including
   mandatory existing liabilities при funding gap; не включать обе альтернативные схемы.
5. Scope/строгость gate закрыты B66: M>0 для всех четырёх типов. Открыты единица
   расчёта/агрегации, overhead attribution и достоверная complete cost model.
6. Future payout fee attribution/bounds, operating budget horizon/aggregation и safety
   scenarios; размеры резервов/тарифы не назначены.
7. Real purpose/own-free основания, capital/loan restrictions и release/reassign policy;
   кто вправе классифицировать, выдавать/отзывать гранты и подтверждать corrections.
8. Impairment priorities, confirmed reversal accounting/deficit/negative bank situation,
   legal settlement и replacement funding; без прекращения user/seller claims.
9. Unified coverage lifecycle и schema upgrade сохраняют synthetic isolation;
   current immutable held rows не UPDATE/DELETE ради release.
10. Outbox ledger/domain category migration, event contracts и delivery security;
    запись внутреннего события не payment command.
11. Production trusted authorization/source/bank adapters и DB roles; providers,
    payment mechanics/fees проверяются отдельно, внешние APIs не подключены.
12. UK legal/accounting review перед commercial launch, отдельное разрешение DDL/
    deployment/интеграции. Нет ручного owner approval каждого штатного исходящего платежа.

## 18. Небольшие безопасные этапы реализации

**Рекомендуемый следующий шаг 6В.5.7-Б:** после утверждения минимального classification
contract — finance-only классификация receipt portions с trusted authority default
deny и synthetic source facts в тестах. Record canonical source ID/revision, exact
portions, evidence/basis/policy и immutable decision/case. Нет income/liability/own-free
permissions, real allocation, release, новых банковских assets или платежей. Можно
начать без deliverable event/worker, локальная immutable classification history; если
нужен outbox, его branch schema согласовать до реализации, не писать dummy journal.

Далее последовательно:

1. Отдельно типизированный domain outbox; strict ledger v1 compatibility tests.
2. Approved accounting/source/cost/budget policies; unified real-purpose coverage
   lifecycle в тестовой среде, без открытых production adapters.
3. Один источник purchase commission: confirmed gross, costs, M>0/cash/budget,
   pending liability/coverage/journal/outbox — одна transaction. No availability/payout.
4. Другие sources после своих paid-event/cost/recognition policies, с уже утверждённым
   единым M>0 B66; no shared guesswork.
5. Legal correction/release/impairment и preservation existing liabilities, отдельные tests.
6. Availability/debt/bonus provenance, automatic payout/refund provider states — отдельные
   согласования/API review, только затем разрешённая интеграция приложения.

Критерии допуска каждого шага: оригинальные receipts/synthetic coverage не ослаблены;
unknown data/default authorities закрывают путь; no double cash/coverage/recognition;
one manager/rollback; immutable history; главная БД/frontend/legacy untouched. Успех
тестов не является разрешением включить FinanceModule или реальные источники.

## 19. Контроль документа

Создан только work/finance-6v5-7A-real-funds-design.md. Код, миграции, тесты,
существующие согласованные документы, БД, Docker и frontend не изменены. Не выполнялись
tests/build, DDL/DML, банковские запросы или Git commit/push/pull/fetch. FinanceModule
не подключён; никаких начислений, резервов реального назначения или выплат не создано.
После отчёта — остановка до отдельного разрешения.


## 20. Согласование с утверждённым B66

Обновлены §6 (универсальная формула и обязательные gates), §16 (контрольные сценарии),
§17 пункт 5 (закрыта область M>0; открыты cost calculation детали) и §18 (план).
Заменены прежние варианты «purchase-only strict / отдельный nonnegative gate».
Противоречащая прежняя неопределённость scope устранена. Ставки 80/20, 50/50 и 0/100,
HALF_UP и platform remainder не изменены. Receipt-only postings, pending conditions,
coverage protection, existing legal obligations и B64–B65 не меняются.

M gate не добавляется к регистрации actual receipt/mandatory accounting correction
как причина отказа только по profitability. Политики доказательства, авторизации,
допустимых проводок и идемпотентности для этих фактов всё равно обязательны.
Новые rates, тарифы, reserve sizes, partner windows или автоматическое субсидирование
не вводятся. Только этот проект и BUSINESS_SPEC_6B_FINAL.md изменены; код не реализован.
