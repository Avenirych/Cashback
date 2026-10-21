# Cashback+ — 6В.5.8-А: безопасные исправления классификации

Дата: 14.10.2026, Europe/London. Статус: **ПРОЕКТ НА УТВЕРЖДЕНИЕ**. DESIGN ONLY.
Документ не разрешает реализацию, применение миграций или рабочие операции.

## 1. Источники и пределы подтверждённости

Изучены:

- `work/BUSINESS_SPEC_6B_FINAL.md`: источники, денежная модель, B61–B65 и B66 (§17).
- `work/finance-6v5-7A-real-funds-design.md`: исправления, coverage lifecycle, полномочия, блокировки, будущие события и этапы.
- `work/finance-classification-validation-edf43a72ab4e46e0adb8bc041ef861ea/report.md`, `report.json`, диагностические логи и результаты 6В.5.7-Б.
- Текущие receipt/verifier, evidence/authority/locks, classification, coverage/mandates, ledger, events/outbox, entities, миграции и тесты в `src/finance/` и `test/finance/`.

**УТВЕРЖДЕНО** означает прямое решение владельца. **ТЕХНИЧЕСКИЙ ПРОЕКТ** означает предложение, а не действующий код. **ТРЕБУЕТ РЕШЕНИЯ** означает выбор до реализации. Полного исходного текста первоначальной 6Б нет уже по ограничению BUSINESS_SPEC; отсутствующие правила не восстанавливаются предположениями.

Preflight: `main`, HEAD `1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9`, staging пуст. Известный status: `?? src/finance/`, `?? test/finance/`. Рабочее дерево не чистое: содержит ранее созданный финансовый контур. Новый документ до начала работы отсутствовал.

**УТВЕРЖДЕНО:** GBP/целые пенсы; immutable history; restricted по умолчанию; отсутствие двойного использования; сохранение существующих обязательств; отсутствие автоматического own-free. Отзыв evidence не освобождает coverage и не сторнирует ledger. Новые полномочия исправления не наследуются от classify_source, evidence-ролей или synthetic мандатов.

## 2. Фактическая архитектура и минимальный безопасный объём

| Контур | Текущее состояние | Следствие |
| --- | --- | --- |
| Receipt/lot | Один подтверждённый receipt → один restricted lot той же суммы; source/account/transaction identity | Исходные receipt, lot, сумма и банковская идентичность неизменны |
| Evidence | Каноническая операция eligible/revoked, version; независимое восстановление; default deny | Применение проверяет текущую operation под общими locks |
| Classification | Immutable command/result и части с диапазонами `[offset, offset+amount)` | UPDATE/DELETE частей и повторный INSERT поверх старого диапазона недопустимы |
| Correction request | Immutable requested: part/reason/actor/context/time | Это жалоба, без exact candidate, approval или apply authority |
| Coverage | Immutable held allocations по lotId/amount; только synthetic purpose | Нет ссылки на classified part/offset; пересечение hold с конкретной частью определить нельзя |
| Ledger/outbox | GBP double-entry; outbox только journal.posted/v1, journalId обязателен | Metadata correction не создаёт cash posting или фиктивный journal |

**ТЕХНИЧЕСКИЙ ПРОЕКТ:** сохранить исходные части как неизменяемые денежные территории. Исправление добавляет новую версию описания **того же** диапазона. Capacity вычисляется по исходным территориям один раз; версии не увеличивают classified amount и не уменьшают coverage.

Первый объём: изменить доказанные category/sourceNamespace/sourceEventId/basis/document references одной части, сохраняя rootPartId, receiptId, GBP, offset и amount. Resize, split/merge, release, признание дохода и обязательств сюда не входят.

**ПРЕДЛОЖЕНИЕ НА УТВЕРЖДЕНИЕ:** пока coverage не связан с диапазонами, блокировать применение revision при любой held allocation на lot или любой финансовой зависимости. Это консервативный gate: «свободную часть занятого lot» нельзя доказать текущей схемой. Request/review могут фиксировать проблему, но не снимают hold. Заблокированный после revoke hold также учитывается.

Наличие только synthetic coverage и отсутствие реальных обязательств сегодня не гарантируют отсутствие будущих зависимостей. Реализация допускается только в isolated receipt-only контуре; будущие recognition/payout consumers требуют отдельного dependency gate.

## 3. Единая схема версий

**ТЕХНИЧЕСКИЙ ПРОЕКТ:** три новые finance-only таблицы; ни одного нового денежного balance/receipt/lot/allocator.

| Таблица | Содержание | Источник истины |
| --- | --- | --- |
| `finance_classification_revision_proposals` | proposalId, optional originalRequestId, rootPartId/receiptId, trusted actor/context, expectedVersion/baseHash, exact candidate metadata, reason, source proof references, schemaVersion, commandKey/requestHash, createdAt | Неизменяемая точная заявка |
| `finance_classification_revision_actions` | actionId/proposalId/rootPartId, kind, actor/context/policyVersion, review/basis refs, proposalHash/baseVersion/bankOperationVersion; applied содержит parentVersion/nextVersion, полный metadata snapshot, approvedActionId и сохранённый result; key/hash/time | Append-only решения и применённые версии, не postings |
| `finance_classification_revision_heads` | rootPartId PK, nullable currentAppliedActionId, currentVersion/generation | Восстановимая projection, без денежного остатка |

Версия 0 — существующая immutable part. Версия n>0 — action `applied` с snapshot и ссылкой на predecessor. Head указывает единственную текущую версию, не содержит amount/free funds. Пересборка head из истории должна дать тот же результат. Metadata history — источник классификационной версии; ledger остаётся единственным источником бухгалтерских проводок.

Нормализовать UUID, сортировать поля/ссылки, сериализовать pennies десятичными строками. Canonical hash не зависит от JSONB key ordering. Версия схемы candidate/action проверяется явно; неизвестная версия отклоняется.

Существующие correction requests сохраняются без правок. Ссылка на старую заявку допустима только после нового authorized proposal под отдельным правом. Никакого автоматического adoption/approval для старых requested. Сохранять первоначального actor и adopter; adoption не скрывает независимость reviewer.

Предлагаемый отдельный `ClassificationRevisionsService`:

- `proposeWithManager(manager, principalReference, command)`;
- `reviewWithManager(manager, principalReference, command)` с approve/reject;
- `applyWithManager(manager, principalReference, command)`;
- отдельное авторизованное read-only чтение history/effective classification.

Только active manager того же DataSource; никакой вложенной транзакции или собственного commit/rollback. Результат provisional до внешнего commit. `post()`, `postWithManager()`, receipt и synthetic coverage APIs остаются совместимыми.

## 4. Жизненный цикл

| Шаг | Проверки/запись | Денежный эффект |
| --- | --- | --- |
| Подача | Отдельное право; exact candidate, baseVersion/hash, причина и доверенное происхождение | Нет |
| Независимое рассмотрение | Reviewer проверяет proposal и source proof, отличается от инициатора/автора проверяемой загрузки | Нет |
| Отказ | Immutable rejected с exact proposalHash, причиной и actor | Effective версия прежняя |
| Одобрение | Approved связывает candidate, baseVersion, bank version, policy и основание | Ещё нет; approval не apply |
| Применение | Повторная текущая проверка approval, прав, evidence, base, source и dependencies; append applied + head CAS | Только metadata в первом объёме |
| Блокировка | Evidence/coverage/dependency/stale/authority reason | Нет release или отмены claims |
| Повтор | Сохранённые IDs/snapshot и replay=true; актуальные blocked/currentVersion отдельно | Нет новых версий или проводок |

`requested → reviewed → approved → applied` либо `requested → reviewed → rejected` — view неизменяемой истории, не UPDATE original request. Первый этап может фиксировать независимое рассмотрение сразу immutable decision; отдельный durable review-started/lease финансово не нужен.

Approved может оказаться apply_blocked/stale. Revoke не превращает историю в rejected и не отменяет ранее committed applied. Restore не применяет candidate автоматически и не делает lot own-free.

Предлагаемая граница при revoked evidence: подача проблемы, read-only рассмотрение и отказ допустимы при своих доверенных полномочиях; новое approve/apply блокируется до восстановления и актуальной независимой проверки. Review не получает права восстановить evidence. Это политика на утверждение, а не изменение существующего receipt/evidence контракта.

**РЕКОМЕНДАЦИЯ:** изменение baseVersion, существенного proof, bankOperationVersion или approval policy требует нового proposal/review со связью на прежний. При отзыве полномочий reviewer история сохраняется, но apply должен заново проверить current approval validity через trusted authority. Эти правила требуют утверждения.

При ожидаемой блокировке допустим immutable `apply_deferred` без applied, если внешняя транзакция committed. При SQL error/rollback этот audit action тоже откатывается: нельзя обещать durable failure record внутри отменённой транзакции. Несекретная диагностика отказов вне неё — отдельная инфраструктура, не частичный financial commit.

## 5. Отдельная авторизация

Предлагаемые права: `request_classification_revision`, `approve_classification_revision`, `apply_classification_revision`. Role mappings пока не утверждены. Default deny; production provider отключён; synthetic grants только в изолированных тестах.

Trusted interface в active transaction разрешает authenticated principal/context/action и current policy. Role string, UUID, evidence permission или coverage mandate не доказательство. Изменения прав сериализуются под authorization lock и аудируются. Remote login/role lookup посреди SQL transaction не обеспечивает эту гарантию; нужен согласованный trusted transactional adapter.

Reviewer не может быть trusted инициатором candidate или submitter того source evidence, которое одобряет. Проверять principal identity, а не название роли/новую сессию. Для adoption legacy request сохраняются original actor и adopter; нельзя обойти независимость новым proposal ID.

**ТРЕБУЕТ РЕШЕНИЯ:** два или три разных principal. Рекомендуется независимый reviewer и отдельный ограниченный technical executor; approve+apply одним действием не разрешать. Это не вводит ручное одобрение владельцем штатных выплат: payout automation — другая подсистема.

Историческая request с classify_source остаётся жалобой. Для revisions не наследуется ни одно новое право. Чтение evidence/history также требует scoped authority; в payload/result не копируются банковские реквизиты или секреты.

## 6. Денежные инварианты

1. Receipt R, lot R, bank identity, journalId/eventId неизменны.
2. Исходные диапазоны лежат внутри `[0,R)`, непересекаются; сумма длин ≤R. Версия не новая длина.
3. Первый apply сохраняет receipt/rootPart/offset/amount/GBP. Нет release, resize, split/merge или overlapping INSERT в original parts.
4. `unclassified = R − sum(original amounts)` неотрицателен и restricted; unclassifiedPenceAtCreation исторический, не live balance.
5. Held coverage не уменьшается при revision/revoke; targets/лимиты/allocations остаются прежними.
6. Ни одна версия не создаёт bank cash, income, own-free, user liability или новый расходный лимит. Category company_funding сама не подтверждает free funds.
7. Ровно одна effective версия, без fork и двух applied successors одной baseVersion.
8. Approval привязан к exact proposalHash/baseVersion; candidate нельзя заменить на apply.
9. Отказ, rollback, revoke и низкая маржа не прекращают существующие user/seller claims или protected recipient reserves.
10. Unknown/settled payout или source correction не делает прежнее покрытие свободным и не является новым receipt.

Пример: R=1000p, original parts 400p+300p, restricted остаток 300p. Исправление metadata версии 400p оставляет classified 700p и остаток 300p. Суммировать 400p прежней и новой версии как две суммы нельзя. При held=500p на lot без range attribution apply blocked; 500p не освобождаются.

## 7. Coverage и зависимости

Сейчас allocation имеет lotId/amount, state=held, без offset/partId. По различию part/target IDs нельзя заключить, что исправляемая часть не обеспечивает target. Проверять **любой** hold на lot под lot lock; revoked hold также занимает capacity.

Первый этап ничего не меняет в coverage/target/lot. Approval не предоставляет release_coverage. Нельзя временно убрать hold, заменить его произвольным lot или вычитать revision amount из aggregate capacity.

В дальнейшем необходим общий coverage lifecycle 7А: origin fragments/ranges или ссылки на effective part/version, единый capacity validator для synthetic и real ветвей. Revision-only allocator, игнорирующий synthetic holds, запрещён. Rebind/replacement потребуют отдельного основания/прав, locks обоих наборов денег, conservation и сохранения claim coverage либо явного funding-gap case.

Dependency gate учитывает recognised source/commission identity, journals, user/seller legal obligations, costs/budget assignments, payout holds и unknown settlement. Если эти структуры ещё отсутствуют, ограничить сервис isolated receipt-only контуром. Неизвестный consumer/dependency блокирует apply, а не принимается за отсутствие обязательства.

## 8. Транзакции и единый порядок locks

Первый workflow: одна исходная часть/receipt. Предварительные read-only reads собирают mapping, но решения принимаются после reread под locks.

1. Active manager, snapshot/validate input, проверка поддерживаемого isolation.
2. Authorization `pg_advisory_xact_lock(726405,0)`; отдельное current right/context.
3. Все accountScope locks 726404 sorted, затем canonical identity locks 726403 sorted.
4. Canonical operation rows FOR UPDATE; reread state/version/proof и mapping.
5. Все lot rows FOR UPDATE, затем receipt rows; затем head/root/proposal/decision в едином порядке таблиц/UUID. Head insert под parent guard + UNIQUE PK: FOR UPDATE отсутствующей строки не mutex.
6. Aggregate held и dependencies под parent lot guard. Все reserve/spend/release writers должны брать его до изменения allocations. Any hold → block первого apply.
7. Current head/baseHash, independence, exact approved candidate, rights/policy, verified source и bank state/version.
8. Idempotency: exact prior → historical result/current blocked; mismatch → conflict. Новая команда append applied + CAS head expected→nextVersion.
9. Deferred DB checks связывают applied/approval/root/head. Commit внешний; ошибка откатывает всё.

Metadata path не берёт ledger locks и не создаёт outbox. Будущая accounting correction заранее собирает полный resource set, затем source/dependency/coverage locks, затем event keys 726402 и sorted accounts. После accounts нельзя дозахватывать более ранний bank/lot guard.

Не брать authorization после lot; не делать generic ledger post перед revision в той же outer transaction. Изменился mapping и нужны новые ранние locks — rollback/replan. Multi-receipt workflow собирает все scopes/identities до нижних locks, не вызывает per-lot helper по случайному порядку.

Deadlock/serialization failure означает rollback всей команды. Допустимый retry использует тот же key/material; не частичный commit. Лимиты и интервалы retry не назначаются здесь. Coarse global lock сохраняется до отдельного доказанного дизайна оптимизации.

### Риск REPEATABLE READ

Active-manager guard текущих сервисов не проверяет isolation. Advisory lock не обновляет уже взятый snapshot REPEATABLE READ. Если parent mutex row только FOR UPDATE, но не UPDATE, транзакция после ожидания может читать старую сумму/overlap, даже когда предыдущий writer committed новые строки. Это логический риск, не воспроизведённый на БД в данном DESIGN ONLY этапе.

Рекомендация минимального этапа: явный READ COMMITTED contract и guard для revisions, согласованный со всеми finance writers. Альтернатива — единый реально обновляемый receipt/lot control generation, stale-snapshot conflict и проверенный SERIALIZABLE/retry contract. Head generation одной части не заменяет lot-wide protocol. Нельзя обещать RR safety без соответствующих тестов и writer changes. Это решение до кодирования, не разрешение сейчас менять сервисы.

## 9. Конкурентные последовательности

| Сценарий | Требуемый результат |
| --- | --- |
| Две revisions одной baseVersion | Один applied successor, другой stale/conflict |
| Два reviews одного proposal | Один terminal decision; identical replay или conflicting refusal |
| Revision и новая классификация | Serialize по receipt/lot; geometry unchanged, исходные footprint участвуют в overlap |
| Revoke-first → apply | New apply blocked; approval/история/holds сохранены |
| Apply-first → revoke | Applied history остаётся; новые действия blocked, без undo/release |
| Reserve-first → apply | Held виден под lot lock; apply blocked |
| Apply-first → synthetic reserve | Сначала metadata commit; затем обычные mandate/evidence/capacity проверки; real purpose не возникает |
| Replay после revoke/новой revision | Original IDs/version/snapshot; current blocked и superseded отдельно; no new writes |
| Permission revoke во время apply | Общий authorization lock определяет порядок; нет обхода смены прав |
| Ошибка после applied до head / deferred commit failure | Полный rollback, нет orphan version/head |

Предлагаемый response: historical result + replay, current blocked/blockedReasons, currentVersion/superseded. Replay не разрешение использовать деньги и не чтение новых метаданных как старого approved result. Pre-existing receipt/coverage replay rules не меняются.

Уникальность должна действовать также по approved proposal, независимо от commandKey. Если новый apply key ссылается на уже применённый тот же exact proposal/base, вернуть исходный applied result с replay=true без новой версии; иной материал — conflict. Проверка одного лишь нового ключа недостаточна. Правила replay не дают права повторно принять экономическое обязательство.

## 10. Проект PostgreSQL ограничений

- Additive finance-only migration; FK origin/proposal/root/receipt, trusted context consistency, no CASCADE deletion истории.
- UUID PK, уникальные commandKey в явно именованных command namespaces, canonical hash/schema.
- UNIQUE applied `(rootPartId,nextVersion)` и `(rootPartId,parentVersion)`; один applied на approved proposal независимо от нового ключа.
- Один terminal approve/reject на proposal; rejected не applied. ApprovedActionId связан с exact proposal/hash/base.
- Head FK на applied action **той же** части; compound FK/deferred consistency, не простой FK actionId.
- Deferred apply completeness проверяет approval, candidate/base, полный allowed snapshot, predecessor chain и согласованный head; orphan applied не committed даже при проглоченной ошибке.
- Head UPDATE только на nextVersion с newly applied action; head rebuild отдельный audited repair, не произвольная правка.
- UPDATE/DELETE/TRUNCATE proposals/actions запрещены; original immutable/range guards остаются.
- Source/evidence/held gate под parent locks; positive GBP bigint и numeric aggregate sums; endpoints без overflow.
- Одни guards/isolation для всех writers. Constraints не аутентифицируют людей/документы; DB permissions и защита от privileged bypass требуют отдельного production hardening.

Не отключать original immutable trigger. Новые версии не INSERT-ятся в old parts. Current-version SUM не заменяет сохранение исходных территорий: иначе исправление могло бы повторно «освободить» деньги.

## 11. Бухгалтерия, B66 и outbox

| Вид изменения | Допустимый путь |
| --- | --- |
| Metadata свободной restricted части, same range, no recognition | Новая версия; cash/ledger/outbox unchanged |
| Category company_funding | Только label; own-free/capital/income требует отдельного доказанного основания |
| Изменение recognised income/user obligation | Отдельная confirmed financial correction с legal basis и сбалансированным adjusting journal |
| Bank reversal/изменение actual cash | Отдельный trusted bank event/receipt-linked correction; original cash journal не редактируется |
| Evidence revoke | Trust block, не automatic reversal/release |
| Неясное бухгалтерское основание | Reconciliation; existing obligations сохранены |

Receipt £10: Dr company_bank_cash 1000p / Cr unallocated_received_funds 1000p. Исправление source label не повторяет запись, не признаёт доход и не переносит suspense в own-free. Не создавать dummy journal ради outbox.

Если ранее признаны user £8/platform £2, замена category на research_referral не делает обязательство автоматически £5. Нельзя списать £3 с пользователя метаданными. Сначала отдельное подтверждённое legal решение; первоначальное £8 obligation сохраняется до законного урегулирования. Здесь не назначаются проводки для неутверждённого основания.

B66 сохраняется: shopping_cashback/rewarded_ads 80/20; research_referral 50/50; passive_ads 0/100. U=HALF_UP(G*r), P=G−U, M=P−C>0; достоверные costs, cash coverage, no double reserve и budget обязательны для нового экономического допуска. Metadata revision не принимает новое распределение и не подменяет этот gate. Existing claims и mandatory accounting corrections не аннулируются из-за M<=0. B61–B65, долговой приоритет, protected reserves, бессрочные GBP и £10/6-calendar-month payout conditions не меняются.

Текущий outbox требует journalId и поддерживает только journal.posted/v1; FinanceEventsService вызывает ledger. Для первого workflow достаточно immutable local actions без worker/delivery. Будущий domain-event extension согласовать отдельно в общей событийной модели, без второго денежного ledger. Настоящая accounting correction пишет domain-state + adjusting journal + его outbox одним manager; банковское исполнение отдельно подтверждается провайдером.

## 12. Будущие изменения геометрии и суммы

Не входят в первый объём. Целевая архитектура должна предусмотреть:

- Split/merge сохраняет ровно union исходной территории, суммы и predecessor/successor связи, без новых денег.
- Уменьшение доказанной classification не уменьшает receipt: разница restricted/unclassified, не own-free; occupied/legal claim требует separate correction/replacement.
- Увеличение classified только из доказанно свободной restricted территории, под общим capacity/range guard и отдельным правом; receipt не растёт.
- Returns/impairment/payout settlement/release — отдельные lifecycle events; no DELETE original parts/allocations.

Нужна общая active-range projection для classification/revisions/coverage и conservation receipt. Не суммировать историю как текущие деньги и не вводить независимый free flag. До отдельного утверждения API отвергает geometry изменения.

## 13. Дефект deferred-триггера 6В.5.7-Б

### Подтверждённая первопричина

Миграция `1791895000000-AddReceiptClassification.ts` подключает общую функцию finance_check_classification к AFTER INSERT двух таблиц. Выражение `CASE WHEN TG_TABLE_NAME='finance_receipt_classifications' THEN NEW.id ELSE NEW."classificationId" END` напрямую обращалось к полю, отсутствующему у root row. PostgreSQL разрешает поля record при подготовке/исполнении выражения; CASE не делает отсутствующее поле безопасным.

В `integration-2.stdout.log` сохранено SQLSTATE 42703: `record "new" has no field "classificationId"`. Это ошибка shape NEW, не денежная корректировка или банковский сбой.

`1791895100000-FixClassificationCompleteness.ts` выбирает поле через to_jsonb(NEW) и uuid cast. Отдельный CREATE OR REPLACE FUNCTION сохранил applied history. Итоговая схема требует обеих миграций: первая отдельно оставляет дефект. Fresh deployment должен применить обе до DML; DDL success не readiness.

### Почему ранние проверки пропустили

Unit migration тест использовал mock query и проверял SQL text. TypeScript/Nest не исполняют PL/pgSQL. CREATE FUNCTION/TRIGGER не проверяет фактический NEW shape при deferred commit. Нужен реальный INSERT и **commit внешней транзакции** для обоих trigger tables.

Первая integration попытка остановилась раньше, на snapshot `column id does not exist`; следующая дошла до deferred body и выявила дефект. После fix итоговые 24 проверки passed; unit regression текста не заменяет commit-тест PostgreSQL.

Уточнение неточности прежнего report.json: snapshot ошибка отнесена там к якобы составному PK postings. Текущая core migration/service имеют `finance_postings.id` UUID PK. У finance_outbox PK — eventId; generic snapshot ORDER BY id использовался для всех таблиц. По коду/схеме именно outbox не имеет id; сам error-log не называет таблицу. Это вывод из сопоставления материалов, не новый запрос к БД. Старый отчёт не изменён.

### Достаточно ли DB защиты

При READ COMMITTED и согласованных locks текущие guards защищают original footprints: GBP/positive amount/offset, bounds, parent receipt, locked overlap/sum, immutable originals. Completeness связывает result с parts и запрещает дописывать часть в committed old command. Предыдущий runner проверил реальную конкуренцию/overlap, revoke и deferred commit.

Для revisions этого недостаточно: нет version/head constraints, независимых approvals, range binding с coverage, dependency gate и isolation guard. Triggers не доказывают bank/source truth и не препятствуют privileged bypass. RR stale snapshot остаётся отдельным риском, не проверенным этим design этапом. Для footprint-preserving metadata не ослаблять original guards; для geometry потребуется общий active-range protocol, не один SELECT SUM.

## 14. Тестовая матрица будущей реализации

Ниже **план**, не выполненные в этом этапе тесты. PostgreSQL только в предварительно идентифицированной isolated finance DB. Не очищать fixtures/volumes для повторов.

| ID | Сценарий | Ожидаемый результат |
| --- | --- | --- |
| T01 | New proposal и authorized legacy adoption | Exact immutable candidate, без inherited rights |
| T02 | Нет provider, role string, evidence/coverage roles | Default deny; no financial writes |
| T03 | Reviewer=инициатор/submitter, другая роль/сессия | Отказ по trusted principal identity |
| T04 | Approve/reject и конкурентные reviews | Один terminal decision, replay/conflict |
| T05 | Exact approved metadata apply/commit | Одна effective версия и полная history |
| T06 | No approval/rejected/подмена candidate/base | Отказ, no partial head/action |
| T07 | Две revisions одной baseVersion | Один applied successor, другая stale |
| T08 | Concurrent identical apply; новый key same proposal | Один applied; стабильный replay |
| T09 | Changed same-key params | Conflict без новых IDs |
| T10 | Replay after revoke/restore/later revision | Original result + current blocked/superseded, no writes |
| T11 | Revoke-first/apply-first, реальные locks | Отказ новой операции или blocked history; no release |
| T12 | Approve, revoke/restore, apply | Version-bound re-review policy |
| T13 | Reserve-first/revision-first; multiple holds | Lot-wide gate, capacity unchanged |
| T14 | Revision и disjoint/overlap new classification | Original footprints сохраняются, overlap denied |
| T15 | Partially occupied lot/unknown dependency | Fail closed, без предполагаемой свободной части |
| T16 | Outer rollback/ошибка до head CAS/deferred failure | Полный rollback, retry того же key |
| T17 | Проглоченная ошибка и commit orphan action | DB completeness отказывает |
| T18 | Permission revoke одновременно с apply/review | Current trusted permission под общим lock |
| T19 | Raw SQL invalid version/approval/context/fork | FK/UNIQUE/deferred отказ |
| T20 | UPDATE/DELETE/TRUNCATE history; append old parts | Immutable history |
| T21 | GBP/zero/float/large pennies/endpoint overflow | Exact integers и numeric sums |
| T22 | Fresh chain 5000000+5100000, root/parts и commit | Оба NEW shapes выполняются без 42703 |
| T23 | Пустой/incomplete result, wrong IDs/category; SET CONSTRAINTS IMMEDIATE | Реальная completeness, не только SQL substrings |
| T24 | Unknown schema/malformed snapshot/wrong head root | Нет silent NULL/обхода version checks |
| T25 | RC и RR snapshot до ожидания mutex | Поддерживаемый isolation доказан; unsupported отказ |
| T26 | SERIALIZABLE/40P01/40001, multi-scope lock ordering | Whole-command rollback/retry, no lock inversion |
| T27 | Accounts/ledger/outbox/coverage/receipts до/после | Metadata path не меняет деньги |
| T28 | Future legal liability/payout_unknown/blocked hold | Claims сохранены, separate financial case |
| T29 | Rebuild heads из applied history | Точное восстановление одной projection |
| T30 | Category 80/20 → 50/50 → 0/100 | Metadata не выполняет split и не отменяет B66/claims |

Гонки проверять минимум двумя реальными соединениями и pg_blocking_pids barriers, не только Promise.all/timers. Unit проверяет manager discipline/errors; PostgreSQL — DDL→DML→deferred commit, locks, rollback. Проверить итоговую функцию после всех миграций; static текст не acceptance test.

## 15. Открытые решения владельца и риски

| Решение | Варианты/последствия | Рекомендация |
| --- | --- | --- |
| Первый объём | Same-range metadata либо resize/split/merge | Только metadata, остальные отдельно |
| Занятый lot | Предположить свободный диапазон либо lot-wide block | Блокировать apply при любом hold |
| Mapping/независимость трёх прав | Два/три principal, human или executor | Independent reviewer + отдельный executor; exact separation утвердить |
| Legacy requests | Auto-active либо authorized adoption | Только новый proposal под новым правом |
| Approval после bank version/restore | Старое одобрение либо re-review | Новый independent review при версии/существенном proof change |
| Отзыв права reviewer | Historical approval достаточно либо current validity | Fail closed trusted current approval validity |
| Isolation | RC-only либо versioned controls/SERIALIZABLE | RC contract первым, все writer paths проверить |
| Monetary release/recognised claims | Metadata shortcut либо отдельный legal workflow | Отдельные права, evidence и balanced correction |
| Domain delivery | Local history либо расширенный typed outbox | Сначала local history, no worker/dummy journal |

Первые шесть политик, isolation contract и граница dependencies требуют согласования до apply реализации. Ни reviewer deadlines, ни TTL, ни тарифы/резервы/партнёрские окна здесь не назначены.

Риски: старый consumer читает original category вместо effective; stale approval; privileged SQL bypass; RR write skew; coverage без диапазонов; label change скрывает economic correction; отдельный allocator освобождает чужой hold; некорректный rebuild head. Для каждого — fail-closed gate и тест выше.

Старый classification replay/result остаётся историческим. Новый effective read возвращает basePart/version/metadata/current blocked, не spendable balance. Будущие economic consumers читают effective version под общей transaction и сохраняют использованную версию. Без их совместимости recognition не включается; старые business APIs/AppModule не изменяются этим проектом.

## 16. Рекомендуемый следующий этап

**6В.5.8-Б после отдельного разрешения:** finance-only immutable proposals и independent review decisions с отдельными default-deny правами, без apply/head и денежных эффектов. Authorized adoption legacy requests. Unit/PostgreSQL T01–T04/T09/T18–T20, commit/rollback; additive migration только в identity-confirmed finance DB, production выключен.

Далее отдельный маленький этап metadata-only apply/head на свободном lot после утверждения scope/approval/isolation. Нужны T05–T30 и сохранность всей денежной системы. Occupied parts, geometry, release и recognised claims запрещены до общего coverage/dependency/legal correction workflow.

Позже отдельные задания: coverage lifecycle/range provenance, контролируемые финансовые корректировки с однозначным legal/accounting основанием, затем approved recognition/платежи. B66 и B64–B65 сохраняются. Успех тестов не разрешает live bank authority, real payouts или FinanceModule→AppModule.

Будущие файлы: finance revisions service/contracts/authority/entities, additive finance migration и unit/isolated integration runner. Никакого переписывания originals/receipt journal. Требование изменить old business tables/API означает остановку и отдельное предложение.

## 17. Контроль DESIGN ONLY

Создан только этот новый документ. Existing BUSINESS_SPEC, 7А, отчёт 7-Б, src/, тесты и миграции сохранены. Проверки этого этапа — чтение локальных материалов/Git и статическая проверка Markdown. Unit/integration/build/миграции не запускались; прежние 142 unit/24 PostgreSQL passes — исторические результаты 7-Б, не доказательство работы revisions.

БД и Docker не опрашивались и не изменялись. Нет начислений, income/own-free, выплат или real allocations. Git commit/push/pull/fetch не выполнялись; FinanceModule не подключён. SHA-256 изученных src/test-finance и исходных документов, HEAD/staging/status сверяются при завершении. После документа работа останавливается до разрешения.

Финальный контроль: SHA-256 223 исходных файлов backend src/, finance-тестов и трёх исходных аналитических документов совпали; новых src/test-finance файлов нет. HEAD, staging и status сохранились. git diff --check и whitespace-проверка нового untracked Markdown не выявили ошибок; Git сообщил только предупреждение о возможном LF→CRLF при будущем Git write. Изменять index или line endings не требовалось.
