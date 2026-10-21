# Cashback+ — 6В.5.5-А: транзакционное evidence и защита от двойных receipts

Дата: 14.10.2026. **ПРОЕКТ НА УТВЕРЖДЕНИЕ. Только документация.**
Предварительно рекомендованная политика не объявляется окончательным решением владельца.
Никакие изменения кода, миграции или банковские подключения этим документом не разрешаются.

## 1. Основание и фактическое состояние

Изучены проект 6В.5.5, BankEvidenceVerifier, BankReceiptsService, receipt/lot entities,
FinanceService, FinanceEventsService, финансовые entities и event contract, три finance
миграции, unit-тесты и test/finance/run.receipts.cjs. Предыдущие результаты: 84 unit и
14 PostgreSQL проверок. Они используют синтетический verifier и не доказывают доверие
реальным банковским документам. В этом этапе тесты и подключения к БД не выполнялись.

Фактические свойства:

- `verify(evidenceReference, claimed)` не получает EntityManager. Default и отсутствующий
  verifier отказывают; доказательство проверяется до receipt identity lock.
- `registerWithManager` требует активный manager того же DataSource/QueryRunner, не
  создаёт собственную транзакцию. Возврат provisional до внешнего commit.
- Identity: namespace + accountScope + transactionId; ключ `bank_receipt:<SHA256>`.
  Material hash включает GBP amount/date и два ledger account ID. Evidence references
  не входят в него: новые доказательства тех же фактов могут подтвердить replay.
- Порядок существующих locks: receipt advisory `(726403, hashtext(identity))`, ledger
  advisory `(726402, hashtext(eventKey))`, затем sorted accounts `FOR UPDATE`.
- Только Dr company_bank_cash / Cr unallocated_received_funds; один receipt — один
  равный ему restricted lot. Ни дохода, ни комиссии, ни own-free cash.
- Receipt/lot immutable; deferred trigger проверяет точный lot, две postings и matching
  sealed journal/outbox. Подлинность банка эти ограничения не проверяют.
- Outbox только `finance.journal.posted` v1, минимальные GBP/journalId/postingCount.
  ReceiptId = eventId = operationId. Событие без journal текущим контрактом не поддержано.

Нет evidence registry/decisions/lifecycle, межисточникового matching или guard будущего
использования lot. Они проектируются ниже, без заявления об уже реализованной защите.

## 2. Инварианты

1. Документ, UUID, hash, внешний ID или слова инициатора не доказывают зачисление.
2. Одна реальная банковская операция имеет одну каноническую identity и один receipt,
   независимо от количества источников наблюдения.
3. Решение допуска перечитывается под lock в той же транзакции, что receipt, lot,
   ledger, outbox и связь решения с receipt.
4. Отзыв и будущие операции с происхождением lot используют общий guard.
5. Verified evidence не делает restricted lot свободным или доступным к выплате.
6. Replay не увеличивает cash. Изменённые существенные факты вызывают конфликт.
7. Отзыв, исправление и сторно не удаляют историю или юридические обязательства.
8. PostgreSQL атомарна для локальных записей, а не для совместной операции с банком.
9. Недоказанная identity/дата/статус/полномочия блокируют новый receipt.

## 3. Минимальное расширение verifier

Предлагается дополнительный контракт, сохраняя существующий интерфейс:

```ts
interface TransactionalBankEvidenceVerifier extends BankEvidenceVerifier {
  verifyWithManager(
    manager: EntityManager,
    evidenceReference: string,
    claimed: BankReceiptFacts,
  ): Promise<VerifiedBankEvidence>;
}
```

Метод использует только переданный активный manager того же DataSource. Проверяет
локальное долговечное решение, matching facts, текущий статус и права под locks.
Не обращается к банку/парсеру, не начинает, не подтверждает и не откатывает транзакцию.
Получение оригинала и независимая сверка проходят заранее, вне финансовой транзакции.
Сетевой timeout не должен удерживать блокировки счетов.

Receipt orchestrator после создания receipt сохраняет association решения/operation
с ним тем же manager. Association имеет FK/unique/deferred completeness constraints;
rollback откатывает её вместе с receipt/journal/outbox. Возвращённый объект proof нельзя
использовать вместо проверки актуального DB state.

Будущее изменение `registerWithManager`:

- Сигнатура и provisional result сохраняются. Перед verifier получает scope/identity
  locks, затем вызывает `verifyWithManager`, далее существующий ledger/outbox путь.
- Для рабочего receipt пути transaction-capable verifier обязателен. При отсутствии
  нового метода — отказ, **никакого fallback к старому verify**.
- Disabled verifier продолжает отказ и для нового метода. Synthetic fixtures меняются
  только в тестах; post/postWithManager остаются совместимыми.
- Старый verify сохраняется для совместимости, но не является разрешением записи.
  Production adapter безопаснее отказывает через этот метод с требованием manager;
  необязательный preview не может выдавать исполнимое разрешение receipt.

Это ужесточение требований к injected verifier, даже при сохранении receipt API:
нужны отдельное разрешение реализации и адаптация тестов. Альтернатива — отдельный
orchestrator с transaction-scoped adapter; она сложнее для проверки отсутствия bypass.
Глобальный/неявный manager и вторая независимая транзакция не подходят.

## 4. Минимальные структуры, без второго денежного реестра

Предлагаемые логические finance-структуры, не созданные таблицы:

| Структура | Назначение и ограничения |
| --- | --- |
| finance_bank_source_scopes | Утверждённый корпоративный счёт, opaque scope, canonical namespace, ledger mapping, source policy/version/status; gate блокировки счёта |
| finance_bank_evidence_artifacts | Неизменяемый original/reference, digest, способ/время получения, uploader, версии; не баланс |
| finance_bank_observations | Отдельная строка/API item, native source identity/version или occurrence reference, raw facts, canonical mapping, quarantine reason |
| finance_bank_operations | Canonical identity/factsVersion, один controlState, nullable unique receiptId, control version; единственный guard признания/использования |
| finance_bank_operation_aliases | UNIQUE(source/account/native identity) → canonical operation; доказанное matching, история изменений |
| finance_bank_verification_decisions | Immutable решение по operation/factsVersion, evidence/policy, инициатор/reviewer, время и причина |
| finance_bank_evidence_events | Append-only approve/reject/revoke/supersede/match/correction с unique commandKey, actor/reason и ссылками; история guard и аудит |

Не создавать два mutable статуса одинакового назначения или отдельный «свободный cash
из evidence». История решений неизменяема; operation.controlState — одна текущая
проверяемая проекция; receiptId отдельно фиксирует однократное признание. Денежная
истина остаётся существующим ledger. Link tables при нормализации не новые балансы.

Один файл выписки содержит много observations; подтверждается конкретная операция,
не произвольное число receipts на файл. Artifact ID/hash — ссылка/целостность, не proof.
EvidenceReference разрешается только через доверенный repository, не клиентский URL.

Association имеет FK receipt и unique canonical identity/receiptId. Decision принадлежит
одной operation и версии фактов; повторные decisions не создают новый receipt.
Новый FK receipt.verificationId → decisions потребует проверки старых синтетических UUID:
их нельзя автоматически превращать в production approvals. Будущий migration/backfill
план отдельный, без переписывания receipt и без основной БД.

## 5. Статусы и переходы

| Объект | Предлагаемые состояния |
| --- | --- |
| Artifact/observation processing | received → parsed → awaiting_match/awaiting_review; quarantined/rejected при проблеме. Parsed не verified |
| Decision | approved/rejected как неизменяемое решение по factsVersion. Revoked/superseded — отдельные события |
| Operation.controlState | pending_review, eligible, quarantined, revoked, reconciliation_required |
| Operation.receiptId | NULL до признания; UUID после создания. До commit provisional; после commit не сбрасывается |

Дополнительный status «consumed» не нужен: receiptId фиксирует признание.
Eligible + receiptId допускает exact replay, не использование lot. Eligible без receipt
допускает регистрацию с active approved decision той же factsVersion.
Quarantined/revoked/reconciliation_required блокируют новую регистрацию и будущее
использование происхождения, даже при другом approved proof. Снятие hold — новое
независимое решение по policy, не просто добавление evidence UUID.

Неподтверждённое matching остаётся pending_review; неоднозначность → quarantined;
конфликт фактов/исправление банка → reconciliation_required. Отзыв → revoked, а при
existing receipt одновременно post-recognition case. Исторический receipt.status
verified не меняется: он описывает первоначальную проверку.

Предлагаемая политика exact replay после отзыва: явный отказ с historical receipt
reference/hold reason, без новых cash записей. Отдельный authorised read-only lookup
возвращает историю. Это требует утверждения: отказ не маскируется под успешный replay.
Review может восстановить eligible при доказанном поступлении, но не изменяет сумму
существующего receipt; исправление cash требует отдельного correction workflow.

## 6. Единый порядок блокировок

Первый минимальный вариант сериализует matching/receipt/revoke и будущий fund use
на уровне bank account scope. Это проще проверить при неизвестных aliases; цена —
меньшая параллельность одного счёта. Оптимизация не входит в первый шаг.

Порядок для всех команд:

1. Source scope registry row `FOR UPDATE`; для нескольких scopes полный набор
   определяется заранее и берётся sorted UUID.
2. Canonical receipt advisory locks 726403 для полного sorted набора identities;
   формат identity SHA256 строго совпадает с текущим receipt кодом.
3. Operation rows `FOR UPDATE`, затем необходимые decision/version rows в стабильном
   порядке. Состояния повторно читаются после ожидания lock.
4. Будущие funding/coverage/domain rows в согласованном порядке IDs. Исходный lot
   immutable, mutable coverage projection требует lock.
5. Ledger event advisory 726402, затем sorted ledger accounts, existing postWithManager;
   journal/outbox/domain inserts и association.
6. Внешний commit/rollback освобождает все locks.

Revoke, matching и снятие hold берут те же scope/operation guards. Нельзя захватывать
scope после account/ledger lock. Receipt lock повторно в той же транзакции допустим,
но встречный порядок между workflow запрещён. Прямой DML guard state закрывается
application permissions и ограничениями; DBA bypass отдельный риск.

READ COMMITTED предлагается как baseline с guards и чтением после lock. Missing row
не защищён одним SELECT FOR UPDATE: scope row создаётся заранее, operation/alias inserts
сериализуются gate + unique constraints. Неизвестный scope не создаётся из input.
Коллизия hashtext излишне сериализует, но не заменяет uniqueness полных identity keys.
Serialization/deadlock failure → полный rollback и допустимый повтор всей команды
с тем же key; не повтор части проводки.

Первый шаг — одна operation/receipt на orchestration. Batch/many-lot/multi-journal
требуют заранее полного lock set; цикл postWithManager → захват нового scope не допускается
без отдельного batch проекта. Generic ledger остаётся внутренним primitive: будущие
fund use commands не могут обойти guard через raw posting/SQL.

## 7. Алгоритмы и гонки

### Регистрация

Вне transaction подготовить исходное evidence и independent decision. Внутри:
validate/snapshot → scope/identity locks → operation/decision read under lock → права,
policy/version, matching и отсутствие hold → existing receipt materialHash replay
либо existing ledger/outbox/receipt/restricted lot inserts → association → outer commit.
Дополнительная approved evidence связь хранится в audit, первоначальный receipt не
переписывается. Ошибка откатывает все локальные записи. Deferred constraints проверяют
полноту association и matching receipt, без банковского вызова под lock.

### Отзыв

Idempotent revoke key, причина и проверенная роль → те же locks → after-lock authorization/
version check → immutable revoke event + operation hold. Если receipt committed,
post-recognition case. Нет удаления/обратной проводки только из-за revoke. Альтернативное
evidence не снимает operation hold автоматически. Повтор revoke не новая корректировка.

### Будущее использование lot

Lot→receipt→operation → полный scope/operation guard set → current eligible и отдельные
purpose/ownership/coverage/margin/budget проверки → atomic allocations/ledger.
В текущем этапе restricted lot всегда запрещён к использованию: проект не разрешает
его разблокировку. Все будущие пути расходования должны применять этот guard.

| Очерёдность | Результат |
| --- | --- |
| Revoke держит lock первым и commits | Receipt/use после ожидания видят hold и отказываются |
| Receipt держит lock первым и commits | Receipt/lot/ledger/outbox сохраняются; revoke затем создаёт post-recognition hold/case |
| Future use держит lock первым и commits | Уже выполненное использование сохраняется; revoke блокирует следующие операции и требует сверки последствий |
| Первая transaction rollback | Ожидающий workflow видит последнее committed состояние |
| Bank reversal после локального commit | Отдельное подтверждённое событие; локальный lock не отменяет внешнее банковское движение |

Гарантия относится к локально зарегистрированному отзыву. Нельзя гарантировать запрет
использования с фактического момента банковского сторно, пока сообщение не получено.
Внешние задержки требуют мониторинга/reconciliation, не обещания распределённой атомарности.

## 8. Межисточниковая идентичность

Canonical namespace — банковский домен/счёт, не транспорт API/PDF/manual или версия
connector. Native ID — alias. Один источник не вправе автоматически завести своё
параллельное пространство receipt identities для уже наблюдаемых банковских операций.

| Случай | Предлагаемое действие |
| --- | --- |
| Общий bank stable ID | Проверить scope/status/facts, map observations на одну operation; mismatch → case |
| Разные stable IDs | Доказанная independent mapping создаёт alias к существующей operation; alias unique, автоматическое переназначение запрещено |
| Нет общего stable ID, но независимая сверка однозначно доказывает occurrence | Возможный исключительный controlled internal occurrence ID после matching, с original evidence/строкой/версией. ID только метка, не proof. Требует отдельного approval |
| Однозначность недоказуема | Quarantine, никакого нового receipt |

Рекомендуемый default без стабильного ID — quarantine до получения достаточного
доказательства и утверждения identity policy. Режим internal occurrence ID отличается
от первоначальной рекомендации stable bank ID и по умолчанию выключен. Нельзя выдавать
random UUID или hash(amount,date,payer) за доказательство отдельного зачисления.

Amount/date/reference fingerprint используется лишь для поиска кандидатов. Две реальные
операции одинаковой суммы/даты не автоматически merge; distinct native IDs без доказанного
mapping тоже не гарантируют разные операции. PDF line number/file digest нестабильны
между выгрузками. Полная source history/statement coverage нужна для доказанной сверки.

Первый маршрут выписки — authoritative observation source с контролем перекрытий,
пропусков и исправленных версий. Новый API сначала observation-only: сверяет aliases
и существующие receipts, не создаёт независимый cash поток. Source rollout отдельный.

## 9. Карантин и manual resolution

Reason codes: missing_stable_identity, ambiguous_match, conflicting_facts,
unverified_source, incomplete_statement, unknown_account_mapping, insufficient_review.
Evidence/observation/candidates сохраняются, journal/lot не создаются. Затронутые
operations получают hold; если набор кандидатов нельзя ограничить, предлагается
временный scope gate для нового признания до сверки. Scope hold требует approval и
не означает удаление денег или произвольную блокировку несвязанных обязательств.

Reviewer проверяет непосредственно банковский источник с независимыми полномочиями,
не просто повторно читает PDF инициатора. Решения: same operation → alias + replay;
доказанная distinct operation → отдельная approved identity; correction/reversal →
case; unresolved → остаётся quarantine. Таймер или отсутствие ответа не снимают hold.

DB uniqueness защищает известные aliases, но не обнаруживает неизвестные соответствия
разных IDs сама. Без достоверного matching нельзя технически доказать отсутствие дубля
только unique constraint: безопасно не признавать сомнительное повторное поступление.
Если два receipts уже признаны, не merge/delete journals: hold происхождений и отдельная
корректировка по accounting review.

## 10. Полномочия и аудит

Предлагаемые роли: intake operator, independent reviewer, source administrator,
receipt writer service, read-only auditor. Uploader не подтверждает свой случай;
разные login одного человека не независимая проверка. Source/admin mapping changes
не дают право скрытно подтвердить receipt. Рабочий verifier выдаёт допуск лишь через
active manager, пользователю недоступны verifier injection, generic ledger и SQL.

Audit: actor/service, command/attempt key, operation/observation/evidence/decision IDs,
reviewer, policy/role versions, before/after state, причина и время. Immutable decisions/
matching events, versioned control projection. Отдельно аудит доступа, смены ролей и
источников; документы/секреты/реквизиты не попадают в outbox или обычные логи.

Успешное использование аудируется той же transaction. Отказ при rollback не сохранится
в её audit insert: failure audit после rollback идёт отдельным nonfinancial/security
каналом, idempotent по attempt key. Это не независимый commit внутри financial verifier.

Закрытое versioned storage, шифрование, MFA, отдельные права на audit предлагаются
для review. Hash — целостность, не авторство. Superuser может обойти DB checks:
нужны ограниченные application roles и независимый аудит. Retention и UK compliance
policy требуют решения, конкретный срок не назначен. Ручная входящая сверка не вводит
ручное разрешение владельца на автоматические исходящие выплаты.

## 11. Сторно и исправления

- Proof ошибочен до receipt: revoke/quarantine без cash recognition.
- Metadata/date correction: новая observation/version/decision; старый receipt не UPDATE.
  Изменённая receivedAt сейчас вызывает material conflict: canonical date policy нужна заранее.
- Amount correction после receipt: отдельный case с origin/evidence, не новый receipt
  на полный corrected total и не переписывание первоначальной проводки.
- Bank reversal: отдельное debit событие со stable identity, amount, origin и evidence.
  Не отрицательный credit receipt. Частичные reversals имеют idempotent keys и общий
  контроль подтверждённых связанных сумм, без повторного взыскания.

Текущий outbox не позволяет нефинансовое событие без journal. Case/audit сохраняет
reversal независимо от будущего corrective posting; новый typed contract требует
отдельного проекта. Не создавать фиктивную проводку только ради события.
Для ещё неиспользованного restricted receipt accounting candidate — Dr unallocated /
Cr bank на подтверждённый возврат, но это не универсальная утверждённая проводка:
после распределения/недостатка cash требуется согласованная модель дефицита/обязательств.
Не отключать nonnegative checks, не маскировать фактическое списание фиктивным receipt.
Юридические обязательства, защита резервов получателя и запрет двойного взыскания сохраняются.

## 12. Минимальные будущие изменения и совместимость

| Область | Что изменить / сохранить |
| --- | --- |
| Verifier | Дополнительный manager-aware контракт и disabled implementation; legacy fallback отсутствует |
| Receipt service | Scope/identity guard до verifier, atomic decision association; текущая сигнатура и provisional semantics сохраняются |
| Finance-only evidence | Registry, observations/aliases, operation guard, immutable decisions/events; shared lock helper |
| Миграция | Отдельная additive migration с FK/unique/version/deferred guards; три существующие не редактировать |
| Ledger | post/postWithManager, GBP integer arithmetic, balanced immutable journal и receipt-only accounts сохраняются |
| Outbox | finance.journal.posted v1 и minimal payload сохраняются; на replay не новые UUID/createdAt |
| Funding lot | Один исходный immutable restricted lot; guard не другой balance и не release |
| Legacy | Ни AppModule, ни старые bonus_transfers/бизнес-модули/frontend не меняются |

Предлагаемые новые файлы: transactional verifier contract/default; evidence/operation/
alias/decision entities; lifecycle/matching services; общий guard/lock helper; unit и
isolated integration tests. Точные имена/schema и deployment синтетических данных
утвердить перед реализацией. Ни основной migration, ни production approvals backfill.

Первый небольшой этап — transactional verification/receipt/revoke/quarantine только
с synthetic verification. Future fund use guard тестируется на локальной тестовой
coverage модели без активации начислений/распределения. Все будущие реальные allocation
пути обязаны применять guard. Банковский connector/worker/платежи отдельно.

## 13. Необходимые PostgreSQL integration-тесты

| Сценарий | Проверяемый результат |
| --- | --- |
| Approved commit | Association, operation receiptId, receipt/lot, journal/outbox видимы вместе после outer commit |
| Failures/rollback по стадиям | Decision/ledger/outbox/lot/association полностью откатываются; повтор не оставляет orphan |
| Disabled/legacy verifier | Отсутствующий новый метод/default отказывают; старый verify fallback не вызывается |
| Manager guards | Foreign/inactive/released manager отказ; нет nested transaction/commit; SQL через caller |
| Concurrent repeats/conflicts | Одна canonical identity с разными evidence создаёт один receipt; изменённый material конфликтует |
| API/statement/manual aliases | Один cash факт; unique alias, ingest/reviewer replay не новая receipt identity |
| Missing ID/ambiguous matching | Quarantine; equal amount/date не proof; реальные distinct события не auto-merged |
| Revoke-first | Управляемый барьер: receipt ждёт guard, после revoke commit отказывает без cash/outbox |
| Receipt-first | Revoke ждёт, затем hold/case; первоначальные committed записи сохраняются |
| Future use vs revoke | Synthetic allocation берёт общий guard: revoke-first запрещает use, use-first блокирует последующие операции после revoke |
| Rollback first transaction | Waiting command видит committed state, не provisional decision/association |
| Policy/roles/source races | Stale approval не обходит revoked role/source; общий authorization lock/version protocol |
| Isolation/deadlock | After-lock read, sorted multi-key locks, полный rollback/replay, не частичный повтор postings |
| DB constraints/bypass | Alias/identity/receipt unique, immutable decisions/events, FK/completeness, ограниченная application role |
| Correction/reversal | Событие/case сохраняется с origin, replay не дублирует; original journal immutable |
| Privacy/audit | Минимальный outbox; failure audit после rollback; никаких секретов/документов |
| Compatibility | Прежние ledger/outbox/receipt tests без ослабления; provisional не считают commit |

Два/более соединения и управляемые барьеры locks, а не искусственные задержки.
Проверять конкретные balances/counts, committed visibility и current states.
Before DDL: имя/роль/OID/schema/history изолированной finance-БД. Эти новые тесты
пока не выполнены; 84/14 прежних тестов не подтверждают проектируемые свойства.

## 14. Решения владельца

1. Начальный controlled statement источник, corporate account и независимые лица/права;
   предварительная рекомендация не окончательный approval.
2. Canonical namespace/authority/aliases; следующий connector observation-only до review.
3. При отсутствии stable ID: рекомендуемый quarantine либо отдельно одобренный verified
   internal occurrence режим. Random ID без proof запрещён в обоих вариантах.
4. Canonical receivedAt/timezone/date precision и reversible native ID mapping;
   не выдумывать midnight UTC или обрезать IDs для прохождения regex.
5. Manager-aware verifier/association, запрет legacy fallback и отказ exact replay при
   revoked evidence с отдельным historical lookup.
6. Operation-level hold независимо от альтернативного proof; снятие независимым review,
   предел scope hold при неоднозначности и ответственность за сверку.
7. Source/policy/role revoke granularity. Scope gate покрывает account source changes;
   глобальный role revoke требует общего authorization lock/version protocol. Чтения
   роли перед transaction недостаточно. Порядок дополнительного auth lock определить
   до scope locks, одинаково во всех workflow, при реализации.
8. Evidence storage/audit/retention/DB privileges и безопасный migration/backfill план.
9. Future reversal/correction/deficit accounting и наблюдение поздних банковских событий
   до коммерческого ввода; обязательства не прекращаются внутренним hold.
10. Отдельное разрешение на finance-only реализацию/tests, затем source review/deployment.

Рекомендуемый первый шаг: manager-aware guard, operation/decision association, scope
lock, revoke и quarantine с synthetic proof. Unknown-ID recognition, реальные connectors,
coverage/distribution, платежи и reversal accounting остаются отдельными согласованиями.

## 15. Контроль этапа

Создан только этот новый документ. Проект 6В.5.5 и остальные существующие документы
не изменены. Код/миграции/тесты/БД/Docker/frontend/Git history не менялись. Банковские
API не вызывались, FinanceModule не подключался. После отчёта — остановка до разрешения.
