# Cashback+ 6В.5.3-Б1 — готовность к реализации

Дата 14.10.2026. Только проект; никаких миграций/доставки/платежей не разрешает.
Источники BUSINESS_SPEC B52–B65 и cost/reserve design 3B.

## 1. Утверждённое и готовое

GBP/HALF_UP и platform remainder готовы в money.ts; ledger/event/outbox поддерживают
active manager, commit/rollback/replay. Account kinds не являются готовыми receipts,
coverage, costs, origin age или payout workflow. Новые покупки требуют M>0 плюс
coverage/no-double-reserve/global budget; existing legal liabilities не write off.

Both payout triggers: >=1000p available либо age six calendar months по самому
раннему confirmed unused/unpaid origin. Amount>full fee для обоих; платформа
платит fee отдельно из confirmed own-free funds. No debt/protected reserves;
provider/security/sufficient principal and fee cover/global budget обязательны.
Unknown existing payout outcome reconcile first. Failed eligibility preserves
full obligation/date и позволяет subsequent checks; schedule не задан.

## 2. Необходимые структуры

Переиспользовать модель 3A, без duplicate funding ledger:
- bank receipts/evidence + funding lots и coverage allocations;
- confirmed commission/cost items/cost assignments;
- obligations + domain operation events/control decisions;
- bonus/cashback slices с immutable origin/originalConfirmedAt, owner,
  unused/unpaid amounts, availability/permissions/protected reserve links;
- versioned fee quote/policy/budget/exposure evidence;
- payout jobs/attempts/provider evidence и distinct principal/fee funding links;
- reminder/milestone jobs и idempotent decision history.

Текущий finance_outbox internal journal fact не платёжная команда. Для domain
transition потребуются новые typed events и version checks. No delivery worker
или provider adapter сейчас не активировать.

## 3. Инварианты

Principal никогда не уменьшается на payout fee. Fee только own-free verified money.
Full amount и original dates сохраняются при defer/transfer/partial use; protected
reserve не payout-available. Six-month age не expiry. Debt priority раньше payout.
Each lot allocated <=actual unspent cash; parent cost once, assignments conserve
sum. Event identity и payout claim уникальны независимо от двух trigger reasons.
External submit !=executed; trusted provider/bank evidence и reconciliation.
M>0 не применяется как retrospective cancellation user liability.

## 4. Будущие миграции (не созданы)

1. Account kinds/FK/ownership + receipts/funding/purpose coverage constraints.
2. Cost/commission/domain events и obligation states/links.
3. Provenance/origin dates/availability и milestones.
4. Fee/budget/exposure versions, payout jobs/attempts/evidence/holds.

Группировку/timestamps уточнить при реализации; не изменять существующие baseline
миграции. Main DataSource не register автоматически. Isolated DB identity/history
preflight перед любым DDL; main migration/deployment требуют отдельного permission.
User ownership deletion не CASCADE финансовые обязательства/immutable history.

## 5. Закрыто и действительно открыто

Закрыто: fee comparison для обоих trigger, fee borne platform, no expiry,
original date persistence, debt/protected exclusions, zero-margin new purchase block.
Открыто: verified tariff/recipient/minimum capabilities; cost completeness и
future fee attribution/bounds; safety/exposure policy и operating budget horizon;
quote expiry/revalidation; recheck frequency/backoff; calendar timezone/end-month;
milestone definition после изменения ownership/oldest slice; provider unknown-result
mapping; own-free evidence; UK legal review/account closure. Не выбирать defaults.
Неизвестные partner return/attribution/highest-order metric остаются blockers
соответствующих purchase workflows, не оправдание пропуска payout gate.

## 6. Тесты/допуск

Both triggers: amount<fee/=fee/>fee; £9.99/£10.00; age-before/at/after milestone;
no debt/with debt; fee funds missing/restricted; principal coverage lacking;
budget fail; protected reserve exclusion; transferred date unchanged;
duplicate/concurrent trigger creates one job; unknown outcome no resend;
defer liability preserved; quote change before submission; cost estimate replaced
not doubled; no margin loss knowingly admitted for new purchase.

Последовательность: owner approves open cost/evidence policies → finance-only
schemas/contracts/validators → isolated unit/integration concurrency tests →
controlled domain operations → provider capability/legal review → separately
approved worker/integration. Сейчас реализация не начинается.
