# Этап 6В.3 — архитектурное покрытие, 13.10.2026

## Источники и пределы

Отдельный полный файл спецификации 6Б в доступных файлах проекта и найденных
диагностических документах не обнаружен. Источник утверждений: сообщения владельца
в этой сессии (базовые требования, изменения об отменах/резервировании/демоданных,
ответственность отправителя, окончательная защита резерва получателя), задания
6В.1–6В.2. Нельзя утверждать проверку неизвестного полного документа 6Б.
Партнёрские окна атрибуции названы в текущем задании, но их значения и политика
закрытия не подтверждены. Ниже не вводятся новые сроки или бизнес-правила.

Код: src/finance/money.ts, ledger.ts, finance.entities.ts, finance.service.ts,
migrations/1791890000000-CreateFinanceCore.ts; test/finance/*.cjs и README.md.
Ранее: 42 unit tests; 10 групп PostgreSQL integration tests (8 в первом запуске,
2 после исправления прерываемого тестового соединения). Новых запусков нет.

## Матрица правил

Источник B — базовые утверждённые требования; D — дополнения об отмене/резерве/
демоданных; L — окончательная ответственность отправителя; P — защита резерва
получателя; F — утверждённая арифметика 6В.1. Статус «основа» не означает реализацию
бизнес-операции или подтверждение партнёрской интеграции.

| Правило / источник | Покрытие ядром | Недостаёт / этап | Обязательная проверка |
| --- | --- | --- | --- |
| Покупки 80/20, B/F | splitRevenue(cashback) | trusted revenue events, receipts / S2 | повтор, частичное подтверждение, conservation |
| Добровольная реклама 80/20, B/F | rewarded_advertising | подтверждённый просмотр и доход / S6 | поддельный просмотр, duplicate event |
| Research referral 50/50, B/F | research_referral | именно доход за привлечение, партнёрские события / S6 | referral vs участие, повтор/отмена |
| Пассивная реклама 0/100, B/F | passive_advertising | отдельные поступления без user bonus / S6 | отсутствие начисления пользователю |
| Платформа только после подтверждения и получения, B | НЕ реализовано | receipts, состояния, settlement / S2 | confirmed без received не начисляет |
| GBP, £0.01, HALF_UP, остаток платформе, F | реализовано | договориться о стадии округления внешних дробных сумм / S0 | boundary, aggregate vs per-event |
| Однократный split, B | уникальный journal eventKey — основа | canonical partner event identity и связь split / S2 | разные ключи одного события не удваивают доход |
| Бонусы и срок, частичное использование, B | счета и пенсы — основа | lots/slices, expiry и источник / S3 | дробление, срок, conservation |
| Перевод с происхождением, L/P | только общий журнал | lineage edges, origin/debtor, transfer allocations / S3 | цепочки, split/merge, account switch |
| Резерв с момента перехода без фиксированного TTL, D | reserved account kind — основа | clicks/offers/orders/reservations / S4 | два клика, transfer vs reserve |
| Резерв до выплаты cashback или отмены, D | НЕ реализовано | точное событие окончания и состояние заказа / S4/S5 | подтверждение не освобождает преждевременно |
| Атрибуция и задержка отчётности, текущее задание | НЕ определено правилами | partner policy versions, late events / S0/S4 | поздний отчёт, retry, отсутствие покупки |
| Резерв/использованная часть получателя защищены, P | нет состояния lot/owner в posting | provenance + locking policy / S3/S5 | reserve/use vs collection |
| Свободная связанная часть получателя погашает долг, L/P | debt account — основа | obligations + recovery allocations / S5 | не трогать несвязанные переводы |
| Освобождение резерва повторно проверяет взыскание, P | НЕ реализовано | единая domain transaction / S5 | release vs re-reserve vs debt repayment |
| Резерв новой покупки должника можно уменьшить, P | возможны balanced reclassification entries | order quote versions, reservation reduction / S5 | подтверждение vs уменьшение |
| Использованные бонусы при cashback clawback не возвращать, D | журнал поддерживает новую корректирующую запись | purchase allocations, debt and offset / S5 | no double debit/credit, cap debt |
| Отправитель окончательно отвечает; получатель не должник, L/P | ownerReference недостаточно | origin liability identity / S3/S5 | много переводов, использованный остаток |
| Новые поступления сначала в долг; собственное погашение, L | debt account — основа | receipt allocation priority, payment confirmation / S5 | concurrent receipt/payout, payment reversal |
| Полное возмещение продавцу после покрытия, D | специальных seller accounts нет | seller payable + refund jobs/attempts / S5 | funded != sent, duplicate confirmation |
| Раздельные GBP/бонус/резерв/долг/платформа, B | account kinds имеются | account provisioning, ownership, read models / S1 | no use of payout GBP as bonus |
| Wise автоматически от £10, B | НЕ реализовано | eligibility, payout hold/job/webhooks / S7 | exactly one claim, full available amount |
| Не хранить банковские реквизиты, B | ядро их не хранит | Wise capability/email verification review / S7 | public/private data separation |
| Уведомления и причина корректировки, L/P | НЕ реализовано | transactional outbox/history/channel policy / S1/S5 | notification failure does not undo payment |
| Маркетинг отдельно от сервисных уведомлений, B | вне ядра | notification preferences / S7 | независимость согласий |
| UI сравнения и исходные ставки сохранить, B | ядро UI не касается | server quote/read model / S6 | исходные проценты и полосы, net monetary table |
| Чистый новый реестр без импорта демо, D | новые finance_* без legacy связи | provisioning only; separate cleanup approval | no automatic import/delete |

## Архитектурные препятствия перед интеграцией

1. FinanceService.post всегда создаёт собственную DataSource.transaction. Его
   нельзя безопасно вызывать как независимую транзакцию внутри изменения резерва,
   долга/заказа/outbox. Нужна внутренняя запись через переданный EntityManager и
   единый orchestration boundary; самостоятельный post может остаться wrapper.
2. Баланс счёта не доказывает происхождение суммы или допустимость взыскания.
   Нужны immutable origin/transfer/allocation records, lots/slices и связи с
   journal/posting IDs. Их можно добавлять отдельными таблицами без изменения
   прошлых завершённых журналов. journalId сам по себе не описывает отменяемое событие.
3. AccountKind и SQL CHECK пока не выделяют seller payable, payout hold, cash
   settlement и нужные expense/reversal счета. Разделение отдельных reserved
   accounts по accountKey возможно, но это ещё не утверждённый chart of accounts.
   Полная модель возмещения, включая долю платформы, требует решения S0 и будущей
   additive миграции. Нельзя перегружать clearing скрытыми обязательствами.
4. ownerReference — строка без referential integrity. Нужны типизированное владение,
   правила создания счетов и ограничения уникальности бизнес-ключей. Нулевой
   initial balance корректен; импорт старых balances не нужен.
5. SQL использует неквалифицированные finance_* имена. До интеграции требуется
   фиксированный trusted schema/search_path либо явная public qualification,
   роли без DDL/trigger-disable и проверка effective privileges. Superuser тесты
   не доказывают неизменяемость против привилегированного администратора.
6. requestHash покрывает только postings. Для бизнес-идемпотентности нужны также
   тип/версия события, origin, actor и business payload; canonical key защищает
   от получения того же партнёрского события под другими техническими ключами.
7. Cached balances управляются posting triggers. Нужны read-only reconciliation
   tests balance vs sum(postings), rejected transaction cleanup и проверка
   диапазона после нескольких postings одного счёта. Intermediate bigint overflow
   может отклонить транзакцию даже при допустимом конечном net balance.
8. Текущий finance README устарел относительно 6В.2: заявляет, что SQL-триггеры не
   проверены и миграция не применена. Применение было только в disposable finance
   DB; основное приложение осталось без неё. На этом этапе файл не исправляется.

Вывод: три таблицы дают расширяемый monetary substrate, но не являются полной
совместимостью со всеми бизнес-правилами. Неизменяемый журнал не мешает компенсациям:
они оформляются новыми сбалансированными journals. Требуемые extensions и единая
transaction boundary должны быть готовы ДО подключения операций.

## Legacy и существующий интерфейс

src/bonus/bonus-transfer.entity.ts: UUID, sourceBonusId, from/toUserId;
src/bonus-transfer/bonus-transfer.entity.ts: integer ID, sender/receiver.
Обе используют bonus_transfers, схемы несовместимы. AppModule подключает первый
BonusModule, не старый BonusTransferModule. Не регистрировать обе сущности.
Будущий безопасный путь: инвентаризация imports/metadata, тест запрета дублирующих
Entity table mappings, пометка старого модуля deprecated; затем отдельное разрешение
на удаление/переименование старой декларации без DDL таблицы. Для нового lineage
использовать finance_* таблицы. Демо операции не импортировать; очищение отдельно.

Shop.tsx: seed products/bonus pool, client Number/round2, cashbackAmount по полной
ставке, Math.floor лимита бонусов. Нужна замена источника/денежных результатов,
не компоновки. В денежной таблице только пользовательский cashback и net bonus;
исходная ставка продавца и cashback ranking сохраняются. 0.8 в dealScore не split.
BonusesContext использует SQLite bonusApi на 3002: без явно согласованного перехода
на PostgreSQL frontend не будет отображать новый реестр. Старые balance/withdrawal
сервисы нельзя подключать как готовую реализацию — нет достаточной идемпотентности.

## Последовательные этапы и критерии готовности

S0 — единая версионированная спецификация и решения владельца. Готовность:
исходные правила, окна атрибуции, значение «выплата cashback», срок бонусов,
частичные возвраты/fee/platform liability/порядок долгов явно согласованы.
S1 — domain-transaction API, account ownership/chart, event schema, outbox и roles.
Готовность: lot/debt change + postings + outbox атомарны; rollback/concurrency и
reconciliation интеграционные тесты пройдены; FinanceModule ещё не подключён.
S2 — received/confirmed revenue и exactly-once split. Готовность: verified partner
input; начисление платформы без receipt невозможно; корректировки отдельно.
S3 — bonus slices/provenance/transfers. Готовность: £0.01, срок и liability origin
сохраняются через цепочки; нет двойной доступности, UI не использует legacy balance.
S4 — offer snapshots/click attribution/orders/reservations. Готовность: резерв
до redirect, отсутствие произвольного TTL, late/unmatched events fail-safe,
атомарное переключение только по утверждённым основаниям.
S5 — settlement/debt/collection/seller refund. Готовность: protected recipient
reserve/use never collected; free linked portion capped; debtor reserve quote
recalculated; receipt and own payment offset debt; seller refund funded once.
S6 — partner ads/referral/passive sources и existing UI read models. Готовность:
все четыре event types корректны, mock payouts отсутствуют; прежняя компоновка,
ставки и comparative bars сохранены, остаточная стоимость после одного split.
S7 — Wise capability review, recipient email settings, payout eligibility/job,
webhooks и service notifications. Готовность: £10 claims once, prior debt settled,
whole available amount paid without repeat consent, no bank data, uncertain
provider response reconciled before retry. Платёжные вызовы требуют отдельного scope.

## Неутверждённые решения

- Полная версия 6Б как единый документ; неизвестные положения не реконструировать.
- Attribution windows по партнёрам, late confirmation, отсутствие покупки после
  клика и доказательство закрытия без произвольного timeout.
- Что означает cashback «выплачен»: партнёр заплатил платформе, GBP settlement
  пользователю или Wise payout; от этого зависит момент завершения резерва.
- Срок бонусов/пауза срока в резерве и возврат ДО перечисления cashback.
- Полный/частичный merchant clawback, превышение бонусов над долгом, fees/FX,
  участие платформы в возврате ранее полученной доли, already-paid funds.
- Какие новые поступления должника участвуют в приоритете погашения, порядок
  нескольких долгов, ограничения имеющихся свободных GBP/бонусов, собственный платёж.
- Переназначение резерва после первого merchant click и поздняя первая покупка.
- Семантика further transfer цепочек и partial allocation без смены должника.
- Wise email-only capability не подтверждена кодом; нужна официальная API-проверка.

## Контроль

Только source/read-only анализ. Docker, PostgreSQL, SQLite, тесты и build не
запускались. Изменяется только новый аналитический файл в ignored work/.
HEAD 1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9; staging пуст.
Локальные src/finance и test/finance сохранены без изменений.
