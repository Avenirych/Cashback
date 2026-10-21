# Cashback+ 6В.5 — план безопасной интеграции

Дата: 14.10.2026. Только анализ; это не разрешение реализации, подключения модуля
или применения миграций. Источник: work/BUSINESS_SPEC_6B_FINAL.md целиком, включая
B21–B51 и T13–T24; актуальные исходники. Спецификация в целом всё ещё «на утверждение»;
её явно утверждённые дополнения учитываются с приоритетом над старыми трактовками.

## 1. Текущее состояние

HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9, main; untracked src/finance/ и
 test/finance/; staging пуст. FinanceModule не включён в AppModule. Миграция
CreateFinanceCore1791890000000 не зарегистрирована в основных DataSource.

src/finance/money.ts: exact bigint/decimal arithmetic, GBP pennies, HALF_UP,
80/20 cashback/rewarded advertising, 50/50 referral, 0/100 passive advertising;
platform remainder. src/finance/ledger.ts: positive balanced postings и available
balance checks. finance.entities.ts: accounts/journals/postings. finance.service.ts:
event-key advisory lock, hash replay check, sorted account locks, transaction/seal.
Миграция: deferred journal balance/nonnegative checks, immutability/anti-truncate.

Исторические проверки: 42 unit passed и 10 групп PostgreSQL integration passed;
не новый прогон. Integration DB cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77,
OID 24780, сохранена. Первый integration runner остановился на тестовом shared-pool
57P01, две оставшиеся группы прошли после выделения отдельного прерываемого DS.
Connection termination не равно PostgreSQL restart/power-loss/restore test.

README ядра всё ещё содержит сведения до 6В.2; его актуализация — будущая отдельная
правка. Старые main DataSource guards нельзя переиспользовать для новой finance DB:
они рассчитаны на историческое другое состояние/идентичность.

## 2. Конкретные точки интеграции

| Область / файл | Будущая точка | Что не делать |
| --- | --- | --- |
| src/users/users.service.ts и user.entity.ts | authenticated immutable user ID → typed finance ownership | не копировать user.balance; не создавать начисления при регистрации |
| src/auth/jwt.strategy.ts | user-existence principal на будущей границе API | не доверять body userId или менять текущую JWT-семантику |
| src/bonus/bonus.service.ts, bonus.controller.ts | будущий domain facade для snapshot/transfer | не добавить post рядом со старым spend/save без общей транзакции |
| src/bonus/bonus-item.entity.ts | сопоставление контракта со slices/origin/status | не импортировать demo amounts/expiry как реальные обязательства |
| src/cashback/cashback.service.ts | заменить будущий entry point доверенным receipt/settlement handler | не включать Number-based addCashback как production начисление |
| src/products/products.service.ts / offer.entity.ts | getOfferById → trusted/versioned offer snapshot | текущие number price/cashback не финансовый authority |
| src/partners/partners.service.ts / seller.entity.ts | identity registry → partner/program policy | listing CRUD не доказательство payable commission |
| Новые orders/click/partner events | one-to-many attribution group и receipts | полноценные order/event workflows сейчас отсутствуют |
| cashback-frontend/src/context/BonusesContext.tsx / bonusApi.ts | будущий authenticated PostgreSQL read adapter | сейчас endpoint по умолчанию SQLite 3002; не смешивать два реестра |
| Shop.tsx / ProductOffers.tsx | authoritative quote/read model в прежних местах | не менять layout, ставки продавца и bars; не доверять client Number totals |
| notifications.service.ts | future transactional outbox consumers | запись notification не означает доставку; не делать внешний send внутри SQL |
| withdrawal.service.ts | отдельный новый orchestration layer | не подключать старый request/approve/reject без state/idempotency защиты |

Сейчас AppModule не подключает старые Cashback/Balance/Withdrawal/Notifications,
Products/Partners как полноценный финансовый контур. Их наличие в src не доказывает
runtime регистрацию или работоспособный контракт будущей интеграции.

## 3. Общая транзакционная граница

Предложение: business command handler открывает ОДНУ transaction и передаёт её
EntityManager всем repositories и ledger writer. Нельзя передавать global manager,
manager чужой DataSource или неактивной transaction. Writer не commit/rollback/release
чужую транзакцию; wrapper post оставляется для самостоятельной технической операции.

Внутри границы: canonical typed event receipt/replay → locks → повторная проверка
ownership/permissions/states → изменения slices/reserves/debts/order versions →
postings/seal → event/domain allocation links → outbox. Commit всех либо ни одного.
Существующие trigger deferred checks выполняются при outer commit. Исключение
после seal/outbox должно откатывать также journal и cached account balances.

Idempotency уровня команды хранит тип/version/source/business payload/result и
links с journal; один requestHash postings не заменяет это. Replay возвращает
сохранённый результат без повторного domain change или outbox. Partner/bank IDs
имеют уникальные отдельные namespaces, повтор под новым client key не создаёт income.

Единый документированный порядок locks: command identity, затронутые owners/group
IDs, debts/reservations/slices в детерминированном порядке, accounts sorted. Все
конкурирующие пути должны соблюдать один порядок. Не разрешать одновременно
один путь «account → slice», другой «slice → account». Точный порядок подтверждать
concurrency/deadlock tests; безопасный retry только whole command с тем же identity.

Внешние запросы не внутри transaction. Outbox worker/provider adapter после commit;
held/submitted/unknown/confirmed разделены. Unknown outcome сначала reconciliation,
никакой новый payment/provider switch. Provider-required action допускает ожидание,
но владелец не подтверждает вручную каждую штатную выплату/merchant refund.

## 4. Денежная модель и будущие структуры

Одна валюта GBP; происхождение cashback/bonus/reward не обмен валют. Company bank
receipt asset отдельно от income и user/merchant obligations. Platform credit
только confirmed+received. Offset debt — внутренние balanced entries, без банковского
движения и повторного revenue. Долг раньше payout, £10 после offsets; оставшиеся
permissions сохраняются, не любая сумма становится payout-eligible автоматически.

Нужны additive finance_* структуры: typed events/receipts/outbox; owned accounts
и chart-of-accounts; slices/origins/transfer allocations; clicks/groups/order
snapshots/partner policy; reservations/selection; obligations/offsets/merchant
payables; payment jobs/attempts/evidence. FK к journal/account/domain entities
добавлять без переписывания historical sealed journals. Main user link проектировать
типизированно; deleted user не должен уничтожать immutable history через CASCADE.

AccountKind CHECK потребуется расширить после утверждения accounting roles:
bank asset, unallocated funds, seller payable, payout/refund holds, fees/reversal.
Не перегружать clearing всеми скрытыми обязательствами. New event/outbox DDL —
отдельная будущая миграция, не изменение уже проверенной baseline задним числом.
No demo import; отдельно разрешённая очистка не часть интеграции.

## 5. Несколько заказов и once-only reserve

Click → attribution group → несколько eligible orders; items принадлежат order.
Commission accounting 80/20 по КАЖДОЙ подтверждённой оплачиваемой покупке независимо
от того, к какому заказу применён бонус. Не присваивать платформе дополнительные
user shares. Bonus selection uniqueness отдельно от commission event uniqueness.

Reserve создаётся перед merchant redirect. Candidate ranking может быть provisional;
final selection ждёт достаточных trusted partner data, attribution/reporting policies.
Без Q13 не назначать final winner/TTL. Выбран один самый дорогой подходящий order
по заранее утверждённому metric и tie-break. Allocation всего заказа, не каждой
позиции. Atomic winner claim + reserve slices + journal + outbox; excess не списывать.

Нужны order versions, late event correlation, finalization evidence и once-only
allocation constraint по reservation/group. Изменение цены/return после finalization
создаёт correction event, не silent повторное списание. Rules для выбора повторного
winner остаются открытыми; код не должен выбирать policy самостоятельно.

Защищённый recipient reserve/use не collect. Release unused recipient slice
повторно проверяет только origin-linked долг. Own debtor reserve можно уменьшить
с quote recalculation, capped debt allocation. Эти изменения также в общей transaction.

## 6. PaymentProviderAdapter без выбора провайдера

Проектировать interface/DTO, fake adapter для тестов, но не real implementation.
Capabilities по GBP/GB/operation type/recipient/funding/idempotency/webhook/query.
Независимые internal IDs и provider references. Hosted recipient onboarding с
реквизитами вне сайта; проверка contract кандидата отдельно до интеграции.
Wise, PayPal Payouts, Stripe Connect не считаются взаимозаменяемыми доступными API.
GB eligibility не определять языком UI, произвольным IP или гражданством.

User payout £10/full available/debt priority и automatic merchant refund сохраняются.
Accounting reserve/evidence не равны bank balance или executed status. Retry policy
основана на проверенном provider contract; unknown результат не повторять вслепую.

## 7. Конфликт bonus_transfers

src/bonus/bonus-transfer.entity.ts — UUID/fromUserId/sourceBonusId;
src/bonus-transfer/bonus-transfer.entity.ts — integer/sender/receiver.
Обе target bonus_transfers. Первый включён BonusModule, второй legacy module не
включён AppModule. Не объединять metadata, не register обоих, не переименовывать
реальную таблицу. Будущий scope: static imports/metadata collision test, отдельное
согласование deprecation/removal старой декларации; new lineage в finance_*.
Ни это устранение, ни старые services не нужны для первого безопасного шага.

## 8. Рекомендуемый порядок

1. Малый transaction primitive refactor ниже, без activation/DDL.
2. Typed command events/result links, ownership/outbox и schema/role hardening.
3. Trusted bank/partner receipt + once-only split и сверка cash/liabilities.
4. GBP slices/expiry/provenance + безопасные partial transfers.
5. Offers/clicks/orders/attribution/reserves и multi-order selection после Q13.
6. Correction/debt priority/protected recipients/merchant payable/refunds.
7. Existing UI read models и переключение authority без редизайна.
8. Provider capability review → автоматические jobs/adapters только отдельным scope.

На каждом шаге: unit/typecheck; separately authorized isolated integration tests;
rollback/concurrent/replay invariants; отсутствие AppModule подключения до явного
authorization. Main application migration/deployment не следуют автоматически
из успешных isolated tests.

## 9. Первый небольшой безопасный этап разработки

Предложение 6В.5.1: выделить ledger writer с переданным активным EntityManager;
post сохранить совместимым wrapper. Никакой бизнес-операции, account provisioning,
UI endpoint, выплат, receipt handler или регистрации в AppModule.

Файлы будущего scope:
- изменить src/finance/finance.service.ts;
- создать src/finance/finance-transaction.spec.ts;
- при необходимости создать src/finance/finance-transaction.ts для guard;
- актуализировать src/finance/README.md;
- добавить изолированные integration tests в test/finance/ только с отдельным
  разрешением на запуск/выбор новой целевой DB.
Миграции на первом шаге НЕ нужны. Typed event/outbox tables — следующий отдельный шаг.
Existing finance.spec.ts изменять только если согласовано изменение внутреннего API;
публичное поведение post должно оставаться тем же.

Unit: active manager passed through, no nested transaction, wrapper exactly one
transaction, foreign/inactive manager rejected, same event replay/conflict,
exceptions propagated; managed writer не release/commit чужую transaction.
Integration: post seal → synthetic domain/outbox marker → injected failure rollback
ALL effects; successful outer commit; replay no duplicate marker/outbox; concurrent
spend; deferred constraints at outer commit. Fixture tables только в isolated DB.
Не подключаться к retained integration DB с synthetic data без target-specific plan.

Критерий готовности: domain/ledger atomicity доказана; все старые core unit scenarios
сохранены; нет финансовых операций в работающем приложении. Открытые партнёрские
правила не блокируют этот ограниченный технический шаг.

## 10. Реальные бизнес-блокеры — по стадиям

Receipt/split: final amount basis, fees/taxes, fractional receipt rounding stage,
user accrual timing. Confirmed+received условие platform уже утверждено.
Bonus lifecycle: expiry, pause/remaining lifetime, partial allocation ordering.
Multi-order: metric, ties, sufficient-data evidence, partner windows/delay,
no-purchase release, cap/excess release, price/partial-return/late winner correction.
Debt/refund: merchant claim amount/platform liability/fees, excess bonus treatment,
priority нескольких debts, own payment/reversal, payout already submitted.
Охват подтверждённых разрешённых средств должника и защита recipient reserve уже
утверждены — не помечать их вновь как открытые.
Payments: actual GB/provider eligibility evidence, hosted recipient support,
automated funding/authorization, fees/retries/status/webhook/reconciliation contract.
No chosen provider; bank/merchant routing capability проверяется отдельно.

Не задавать срок возврата товара или attribution days: в доступных правилах нет
подтверждённых значений. Не предлагать multi-currency/international scope сейчас.
Всё перечисленное блокирует соответствующие business workflows, НЕ isolated
manager-aware primitive. Реализация следующего шага всё равно требует разрешения.

## 11. Контроль

Создан только этот отчёт в work/. Source, migrations, tests и specification не
изменялись. Docker/DB/SQLite/network providers не опрашивались. Tests/build не
запускались. Git history/index не менялись; HEAD и исходный status сохранены.
