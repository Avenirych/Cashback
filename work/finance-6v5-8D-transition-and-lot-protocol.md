# Cashback+ — 6В.5.8-Г: переходная модель candidates и lot-протокол

Дата: 14.10.2026. **Предложение до реализации; требует решения владельца.**
Код, миграции и БД не изменены. Этот документ не является результатом реализации candidates.

## 1. Preflight и материалы

main; HEAD `1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9`; staging пуст. Известный status: `?? src/finance/`, `?? test/finance/`. Изучены BUSINESS_SPEC_6B_FINAL, проекты 8-А/8-В, отчёт реализации 8-Б, текущие classification/correction/evidence/coverage/authority и миграция AddCorrectionReview1791896000000.

Владельцем прямо указано: если нужна переходная модель старых решений, представить её до реализации. Она необходима по причинам ниже, поэтому реализация остановлена до изменения кода.

## 2. Ограничения существующей схемы

1. `finance_classification_correction_decisions` имеет UNIQUE(requestId,operationVersion). Ограничение охватывает reason-only approved/rejected. Старое решение уже занимает единственное место текущей банковской версии; новое точное решение туда не вставить.
2. Исторический decision не содержит candidateId/fingerprint/baseVersion. Подставить эти значения задним числом нельзя: решения immutable и владелец запретил backfill.
3. `reviewWithManager()` блокирует любое второе решение текущей версии, а `current()` считает текущий decision одобрением/отказом без distinction reason-only/candidate-bound. Этот view нельзя использовать как future apply readiness.
4. Проект 8-В описывает один candidate на request. Новое задание требует рассмотреть несколько candidates одной request. Это дополнение имеет приоритет, но политика смены уже одобренного candidate при неизменной evidence version ещё не определена.

Наличие двух candidates и выбор одного первого approval решаются без изменения денежных writers. Замена уже существующего действующего approval — отдельное решение: нельзя незаметно убрать UNIQUE и получить два одобрения.

## 3. Рекомендуемый минимальный переход — вариант A

Сохранить existing requests и decision history как единственную систему заявок/решений. Новая finance-only таблица candidates — дочерняя таблица request, не самостоятельный workflow.

- Candidate имеет свой UUID и requestId FK; несколько immutable candidates одной request допустимы.
- Existing decisions получают nullable candidateId/fingerprint/baseVersion/baseHash binding. Все исторические значения остаются NULL; никаких UPDATE данных/backfill.
- Старый review API сохраняет reason-only семантику истории, но его response не считается candidate-approved/apply-ready. Новый exact-review метод требует candidateId и ожидаемый fingerprint.
- UNIQUE(requestId,operationVersion) остаётся. Для новой request только одно независимое approved/rejected решение текущей версии. Гонка approvals разных candidates даёт один winner, второму отказ, не автоматическое supersession.
- Если reason-only decision уже существует текущей версии, exact review получает определённый отказ `LEGACY_DECISION_REQUIRES_LINKED_REQUEST`. Историческое решение не меняется.
- Для продолжения — новая linked request **в существующей таблице**, с проверенной identity инициатора, точным candidate и новым independent review. Ссылка на прежнее обращение сохраняется как provenance в candidate attachment; это не перенос старого approval.
- Не отзывать/восстанавливать evidence искусственно ради обхода UNIQUE. После настоящего restore новая банковская версия позволяет новое independent решение, старое не возвращается в силу.

**Ограничение A:** после первого approval нельзя одобрить другой candidate той же request/evidence version. Можно хранить его proposal/history, но review откажет. Для новой metadata intent нужна новая linked request либо отдельно утверждённая policy supersession. Отказ одного candidate тоже остаётся terminal в этой версии, как в 8-Б; scope отказа не меняется автоматически.

Вариант A рекомендуется для ограниченного этапа: сохраняет существующий DB gate, не переписывает историю и не вводит неподтверждённые полномочия отмены approvals. Его ограничение и linked-request переход необходимо подтвердить до кодирования.

## 4. Альтернатива B — review rounds и явная смена approval

Если необходимо повторно одобрять разные candidates **той же** request и банковской версии:

- Добавить immutable review rounds/supersession actions в той же системе requests/decisions.
- Ввести одну восстановимую approval-head projection request/evidence version; active candidate определяется ею, а не суммой approved rows.
- Заменить нынешнюю уникальность на согласованные round constraints + atomic CAS active head. Старые reason-only решения сохранить как legacy rounds без candidate applicability.
- Одновременно записывать supersession старого и новое exact approval под request/operation locks; не создавать окно двух действующих approvals.
- Утвердить, кто вправе инициировать/подтвердить supersession, независимость, scope отказа и replay старых rounds.

B сложнее A и требует нового бизнес-решения о replacement. Его нельзя считать автоматически разрешённым только формулировкой «не допускать двух одновременно действующих approvals».

## 5. Candidate и fingerprint после выбора перехода

Предлагаемый immutable candidate: UUID, requestId, originalPartId, expectedBaseVersion/baseHash, точные proposedMetadata, operationId/operationVersion, trusted initiator actorId/participantId/context, schemaVersion, contentFingerprint, commandKey/requestHash/time.

Allowlist metadata: существующая category, sourceNamespace/sourceEventId, basisReference/documentReferences. GBP/amount/offset/receipt/lot не редактируемые поля. Protected origin/range fingerprint строится из БД, не из пользовательского payload. Source proof проверяется отдельным доверенным интерфейсом; UUID/hash не доказательство.

Детерминированный contentFingerprint строится из нормализованных request/part/base/evidence/metadata/participant/context/schema facts. Случайный candidateId, commandKey и время не подменяют content identity. UUID нормализованы, document refs сортированы/уникальны, денежные fingerprints используют точные десятичные строки. Envelope audit actor и idempotency hash учитываются отдельно. Подменить fingerprint одного candidate содержимым другого нельзя.

Создание требует отдельного доверенного request права и проверенного participantId, совпадающего с допустимым инициатором request; технический account не отдельный человек. Review требует существующего отдельного review права и независимого participant. Нет inheritance из classify_source/evidence/mandates; production default deny.

Сейчас effective classification versions не реализованы, original parts immutable. Для начального candidate binding baseVersion=0 означает именно original part плюс baseHash; expectedVersion>0 отклоняется, а не имитируется отсутствующий head. После будущего apply нужны общий effective-base resolver и новая проверка актуальной версии до activation. Concurrent privileged/unsupported изменение source нельзя считать нормальным writer.

После revoke/restore прежний approval historical, не current. Новый exact review обязан ссылаться на актуальную operationVersion и candidate, допустимый для этой версии. Same-key replay возвращает прежний ID/fingerprint/decision и текущий blocked/stale признак, без нового approval. Старые NULL identities или reason-only bindings не apply-ready.

## 6. Безопасность без изменения coverage на данном этапе

Candidates и точный review не используют деньги, не принимают zero-coverage решение и не создают spend permission. Их можно реализовать в существующем READ COMMITTED review контуре под текущими locks, не изменяя coverage-writers.

Порядок: authorization 726405 → scope 726404 → identity 726403 → canonical operation → lot → receipt → request → candidate → decision. Candidate creation/review не вызывает ledger/outbox и не изменяет original classified parts/allocations. Любые итоговые results явно не разрешают application.

Это не решает future SERIALIZABLE apply freshness; apply остаётся запрещённым до общего протокола ниже. Coverage на lot не мешает фиксировать exact review, но запрещает будущее применение.

## 7. Проект обязательного общего lot-протокола

**Только проект, никаких writer changes сейчас.**

- Одна sidecar `finance_lot_control_versions(lotId PK/FK, generation)` без amount/free/capacity полей. Это freshness guard, не финансовый balance.
- Каждый writer allocations/coverage lifecycle и future apply обновляет generation в той же transaction. Реальный UPDATE обязателен; advisory или FOR UPDATE immutable lot не обновляет старый snapshot.
- Missing guard → fail closed. До активации future apply контролируемо создать guards для всех lots, обеспечить insertion hook новых receipts; не lazy unsafe fallback.
- Existing порядок: authorization → все scopes sorted → все identities sorted → operation rows → **все lot rows sorted → все control rows sorted** → branch-specific receipt/request/candidate/decision либо mandate/target/allocations.
- CoverageService сейчас берёт все lots до mandate/target, поэтому controls добавляются непосредственно между ними. SQL guards должны иметь тот же rank; поздний control lock только после mandate/target не считается совместимым планом.
- Все поддерживаемые writer paths, включая multi-lot inserts и будущие release/retarget/spend, обновляются до activation apply. Coverage amounts, held history и restricted status не переписываются.
- SERIALIZABLE apply со snapshot до committed READ COMMITTED allocation сталкивается с changed control row и abort/retry; fresh transaction видит hold и блокирует apply. Apply-first commit допускает обычное последующее synthetic reserve, без real purpose.
- Evidence revoke/restore уже реально изменяет operation version под bank locks. Permission/participant/proof validity изменения требуют аналогичного согласованного trusted authorization version protocol; иначе production apply deny.
- Future outer executor повторяет всю SERIALIZABLE transaction для 40001 с тем же key/material, bounded finite configuration. Retry counts/backoff не назначаются здесь. Unknown commit сверяется по stable key, не создаёт новую application identity.

Перед будущим включением: отдельно разрешённые additive finance migration/control helper, минимальные CoverageService/DB guard updates, и доказанные mixed-isolation tests. Не требуется менять все finance-транзакции на SERIALIZABLE.

## 8. Тестовая матрица после утверждения перехода

| Проверка | Критерий |
| --- | --- |
| Candidate creation/idempotent replay/changed metadata | Один stable result либо conflict; new material не UPDATE |
| UPDATE/DELETE/TRUNCATE candidate | DB immutable отказ |
| Exact ID/fingerprint/base/evidence binding | Decision подтверждает ровно этот candidate |
| Requester/второй account same participant/unknown identity | Denial, без обхода trusted context |
| Два candidates одной request, simultaneous approval | Один current decision; второй conflict по A либо controlled supersession по B |
| Legacy reason-only current decision | NULL bindings сохранены; typed review не ретрофитит старое решение |
| Revoke/review обе последовательности | Block либо historical stale decision; no trust bypass |
| Restore и старый replay | История сохранена; fresh independent current approval требуется |
| Base hash/version change до review | Stale отказ; original-part UPDATE уже immutable |
| Outer rollback после candidate/decision INSERT | Все новые metadata rows откатились |
| Monetary snapshot | Parts/allocations/accounts/ledger/outbox unchanged |

Отдельно для lot protocol: два реальных соединения с pg_blocking_pids, READ COMMITTED reserve против SERIALIZABLE apply со snapshot до ожидания; both commit orders; concurrent revoke/restore; отсутствующий control; multi-lot ordering; 40001 на statement/commit и exhausted retry; rollback generation вместе с allocations/application; raw SQL guard и writer bypass. Эти future tests не выполнять до отдельного разрешения на writer изменения/apply.

Тесты candidates/review разрешены после выбора перехода только в identity-confirmed isolated finance DB. Ни миграции, ни tests в данном pre-implementation этапе не запускались.

## 9. Решение, необходимое владельцу

**Рекомендуемый выбор A:** несколько immutable candidates, но одно terminal решение request/evidence version; историческое reason-only решение не расширяется; новое точное рассмотрение при занятом slot — новая linked request существующей системы. Для замены approval в рамках той же request/version потребуется отдельный вариант B с утверждённым supersession.

После выбора можно реализовать candidates + nullable exact decision bindings и tests без coverage changes/apply. B66, деньги/долги/резервы, бессрочные balances и payout policies не меняются: review не экономическое распределение.

## 10. Контроль состояния

Создан только этот новый проектный документ. Исходники, тесты, миграции, существующие work/spec документы не изменяются. БД/Docker не опрашивались; никакого дохода, own-free, начисления, выплаты или application. FinanceModule не подключён. Commit/push/pull/fetch не выполнялись. HEAD/status/staging и SHA-256 исходных материалов проверяются при завершении. Работа остановлена до утверждения перехода.
