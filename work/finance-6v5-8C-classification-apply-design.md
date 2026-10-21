# Cashback+ — 6В.5.8-В: атомарное применение исправлений классификации

Дата: 14.10.2026, Europe/London. **DESIGN ONLY; проект на утверждение.**
Ни один описанный ниже метод, constraint, control row или migration этим документом не реализован.

## 1. Источники и фактическое состояние

Изучены BUSINESS_SPEC_6B_FINAL.md (включая B61–B66), проекты 6В.5.8-А и 6В.5.7-А, отчёт `work/finance-corrections-validation-453feb721b6c46b7ba52e9911ffd594e/report.md`, текущие classification, correction authority/requests/decisions, evidence/locks, coverage, ledger, outbox и соответствующие миграции.

Исторические результаты 6В.5.8-Б: 157/157 unit, 39/39 PostgreSQL, typecheck/build успешны. Они подтверждают submission/review, **не apply или SERIALIZABLE**. На данном этапе тесты и подключения к БД не выполняются.

Preflight: main, HEAD `1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9`; staging пуст; известные untracked `src/finance/`, `test/finance/`. Новый документ отсутствовал. Production providers закрыты; FinanceModule не подключён.

Метки: **УТВЕРЖДЕНО** — правила владельца; **ТЕХНИЧЕСКИЙ ПРОЕКТ** — способ их реализации; **ОТКРЫТО** — решение до кодирования. Неполнота первоначальных материалов 6Б, отмеченная BUSINESS_SPEC, сохраняется: недостающие правила не додумываются.

## 2. Утверждённая граница применения

Разрешены только проверенные метаданные одной классифицированной части. Неизменны:

- rootPartId, исходный classificationId, receiptId, funding lot и банковская идентичность;
- GBP, amountPence, offsetPence, конец диапазона;
- receipt amount, restricted status/purpose, coverage allocations и их capacity;
- user/seller obligations, долги, защищённые резервы и банковские суммы;
- accounts, journals, postings и существующий outbox.

История исходной части и всех версий неизменяема. Нет UPDATE/DELETE original part, overlapping INSERT в старую таблицу, освобождения диапазона, income/own-free или начисления. Любая попытка resize/split/merge/change receipt отклоняется.

Отдельное доверенное `apply_classification_correction`; verified participantId исполнителя отличается от participantId инициатора. Технические аккаунты одного участника не обходят эту проверку. Нужны актуальное independent approval, совпадающая bank operation version, eligible evidence, отсутствие любого coverage на lot и отсутствие competing applied version. Production default deny.

Ограничение any coverage включает blocked held synthetic allocation: отзыв evidence не уменьшает резерв. Здесь не разрешаются реальные allocations или release. Review на covered lot остаётся допустимым по 8-Б; apply — нет.

## 3. Два выявленных условия готовности

### 3.1. Одобрение пока не определяет точные изменения

Текущая request хранит part/reason/actor/participant/context, а decision — approve/reject, reason/basis и bank version. Нет exact candidate metadata, baseVersion или baseHash. Поэтому **существующее approved 8-Б нельзя автоматически использовать для произвольного apply payload**. ApplicationImplemented:false в текущем response соответствует этой границе.

Не «дописать» новый candidate к старому decision и не считать UUID basisReference хешем всех одобренных изменений. Необходимо отдельное подтверждение exact candidate независимым reviewer. Все старые reason-only decisions сохраняются как история и не становятся apply-ready.

### 3.2. SERIALIZABLE apply и READ COMMITTED coverage

Coverage сейчас берёт shared authorization gate, bank locks, lot FOR UPDATE, затем mandate/target; capacity читает SUM allocations. Lot immutable и не обновляется при резервировании. Correction review явно допускает только READ COMMITTED. Нельзя вызвать его stateWithManager/reviewWithManager из новой SERIALIZABLE transaction и обойти этот guard.

Advisory lock не обновляет уже сформированный transaction snapshot. SERIALIZABLE одного нового метода не даёт основания предположить, что predicate «coverage отсутствует» видит любое committed изменение другого READ COMMITTED writer. Нужен общий lock/version protocol, а не переименование уровня изоляции. Это вывод проектного анализа, не воспроизведённый в этом этапе дефект.

Документация PostgreSQL различает согласованную serializable модель и применение explicit locks при других writers; stale snapshot нельзя считать свежим после ожидания lock. См. [PostgreSQL 17: Application-level consistency](https://www.postgresql.org/docs/17/applevel-consistency.html).

## 4. Точный candidate без второй системы заявок

**ТЕХНИЧЕСКИЙ ПРОЕКТ:** существующие requests/decisions сохраняются. Добавить immutable приложение `finance_classification_correction_candidates`, PK/FK requestId, не самостоятельный request workflow.

Candidate содержит:

- requestId, rootPartId, contextId, schemaVersion;
- expectedBaseVersion, baseMetadataHash и защищённый geometry/origin fingerprint;
- exact proposedMetadata и canonical candidateHash;
- independently verified source proof references и время создания.

Allowlist proposedMetadata: category из шести существующих категорий, sourceNamespace, sourceEventId, basisReference, documentReferences. VerificationId/verifierReference производятся trusted verifier, не принимаются как произвольное изменение от клиента. Денежные поля candidate копирует для fingerprint только из immutable root, не как редактируемый payload.

Один candidate на request, immutable. Новый материал/base требует новой request **в той же таблице**, со ссылкой происхождения на прежний request в candidate attachment; это новая версия обращения, не параллельная система заявок. Participant нового инициатора должен быть достоверным; старые NULL не получают фиктивной identity.

Будущая additive migration расширяет existing decisions nullable binding полями candidateHash/baseVersion/baseHash. Старые строки сохраняют NULL и **не допускают apply**. Новый typed review записывает binding одновременно с decision, проверяя immutable candidate и current base. Existing UNIQUE(requestId,operationVersion) сохраняется.

Если request уже имеет reason-only approved той же bank version, второй decision той же версии вставлять нельзя. Рекомендация: новая linked request в существующей системе + candidate + свежий review, не ослабление уникальности и не перезапись старого approval. Если у request ещё нет решений, exact attachment допустим до первого review при отдельном trusted request праве и доказанном инициаторе.

**ОТКРЫТО:** утвердить этот conversion путь и точную allowlist. Альтернатива — revision-aware новые review rounds в той же request, но она требует отдельной миграции decision uniqueness/state semantics. Для минимального этапа она сложнее и не рекомендуется. Никаких автоматических conversions в этом design этапе.

## 5. Хранение применённых версий

| Структура | Поля / назначение |
| --- | --- |
| `finance_classification_applied_versions` | appliedVersionId, rootPartId, requestId, approvedDecisionId, candidateHash, parentVersion/parentAppliedId, nextVersion, full verified metadata snapshot/hash, operationId/version, executor actorId/participantId/context, commandKey/materialHash, immutable result/time |
| `finance_classification_version_heads` | rootPartId PK, currentVersion, nullable appliedVersionId; восстановимая projection без money balance |
| `finance_lot_control_versions` | lotId PK/FK, monotonic generation; concurrency control, без amount/free/coverage totals |
| Authorization epoch/control | Существующая trusted auth version, если её guarantee достаточна; иначе finance-only epoch для согласованного local authorization adapter |

Candidate и nullable decision bindings дополняют request/review. Applied versions/head дополняют классификацию. Lot generation защищает freshness, **не создаёт второй источник cash/capacity**: суммы остаются original parts/allocations/ledger.

Версия 0 — исходная classified part. Версия n>0 — immutable applied record с predecessor и full snapshot. Head имеет единственную ссылку; rebuild history→head обязан давать тот же результат. Двойное суммирование версий как денег запрещено.

DB ограничения проекта:

- FK request/candidate/approved decision/root/receipt context; nullable historical bindings не apply-ready;
- UNIQUE commandKey; UNIQUE approvedDecisionId и requestId для одного применения; UNIQUE(rootPartId,nextVersion) и successor(parentVersion);
- approved decision точно соответствует candidateHash/baseVersion/baseHash и bank operation/version;
- head compound FK на applied **той же части**, version consistency и CAS nextVersion=old+1;
- deferred completeness applied↔head/predecessor/approval; нельзя commit orphan version или head без history;
- original fingerprint/GBP/range unchanged; immutable applied/candidate rows, no DELETE/TRUNCATE;
- control generation может только возрастать; оно не «снимает» hold и не заменяет SUM capacity.

Один part на команду. Multi-part/multi-receipt revisions не входят в минимальный этап.

## 6. Trusted authority и independent approval

Расширение CORRECTION_AUTHORITY/отдельный совместимый apply capability требует явного права apply_classification_correction, verified identity и scoped context. Нет inheritance от request/review/classify_source/evidence/coverage. Production adapter default deny.

Executor participantId ≠ requester participantId. Reviewer participantId ≠ requester, что уже проверяется в 8-Б. Проверки выполняются для trusted ответственного участника, а не только actorId. Полномочия, identity mapping и approval validity читаются транзакционно; их изменения должны участвовать в том же epoch/lock protocol.

**ОТКРЫТО:** может ли reviewer также быть executor. Владелец утвердил независимость от инициатора, но не обязательно три разных участника. Рекомендуется отдельный technical executor с отдельным правом; минимум нельзя разрешать requester apply через второй аккаунт. Не объявлять требование трёх людей уже утверждённым.

Source facts candidate проверяются trusted interface независимо от caller metadata; reused verifier capability не должна автоматически выдавать classify_source. Нет remote banking/authorization I/O внутри transaction. UUID/document/hash — ссылки, не самодостаточное доказательство.

При revoked evidence новые apply запрещены. Restore увеличивает bank version; old bound approval непригодно. Новый independent review текущей версии нужен даже если candidate не изменился. Proof/policy/identity validity changes требуют fail-closed проверки; точные правила устаревания вне bank version ещё должны быть утверждены.

## 7. Совместимый порядок locks и план его расширения

Сохранить существующий порядок, добавляя guards в заранее определённых местах:

1. Shared authorization advisory `(726405,0)`.
2. Authorization epoch/version row, если требуется новым trusted adapter.
3. Все accountScope guards 726404 sorted.
4. Все canonical identity guards 726403 sorted; operation rows sorted FOR UPDATE.
5. Все lot rows sorted FOR UPDATE, затем **все lot control rows sorted FOR UPDATE**.
6. В apply ветви: receipt → request → candidate → decision → part head, в фиксированном table/UUID порядке. В coverage ветви: после lot controls existing mandate → target → reservation/allocation.
7. Проверки exact binding/current state/coverage/base; append version и head CAS.

Global gate остаётся coarse, оптимизация не предлагается. Head/request не брать до lot; auth не брать после lot. Metadata apply не вызывает ledger и не берёт accounts/event locks. Для будущей денежной correction нужен другой заранее собранный resource set, до ledger event/account locks.

Текущий coverage уже берёт ВСЕ lot rows до mandate/target. Поэтому будущий prelock всех lot control rows непосредственно после lot rows не инвертирует existing ordering. SQL insertion guard должен соблюдать тот же порядок; поздний control-lock только в AFTER INSERT, уже после mandate/target, не считается корректным протоколом.

### Общий lot generation — обязательная подготовка

Каждая новая coverage allocation и будущий release/spend/retarget изменяет generation связанного lot **в той же транзакции**. Apply тоже изменяет generation при успешном metadata commit. Это реальный UPDATE control row, не advisory-only signal.

При snapshot до committed coverage update SERIALIZABLE apply обнаруживает changed control row при locking/updating и должен abort/retry, вместо чтения устаревшего zero coverage. После fresh retry sees hold → application blocked. Пока apply держит lot/control locks, coverage writer не может вставить hold до commit/rollback. Если apply-first committed, дальнейшее synthetic reservation остаётся отдельной обычной операцией; metadata change не даёт real purpose.

Нет lazy missing control fallback. До активации: additive migration создаёт control row для каждого существующего lot; новые receipts создают его транзакционно через согласованный insertion hook. Пустой/отсутствующий control row → fail closed. Seed generation — техническая версия, не денежный backfill.

CoverageService и DB guards требуют согласованных finance-only правок для всех writer paths, включая прямой разрешённый SQL и multi-lot batch. Existing amounts/statuses/allocations не переписывать. Нельзя включить apply до обновления всех поддерживаемых writers. Privileged bypass не входит в guarantee; DB permission hardening обязателен до production.

### Authorization freshness

Сам global advisory lock не делает старый SERIALIZABLE auth snapshot свежим. Permission/participant/proof validity writers должны реально обновлять согласованный authorization epoch под тем же gate. Apply блокирует/читает эту row и проверяет current trusted facts; изменение после его snapshot приводит к serialization abort/retry. Если provider не способен дать такой локальный атомарный контракт, production apply остаётся default deny.

Это план будущего isolated adapter/guard, не изменение Windows/auth сейчас и не заявление о возможностях существующего отключённого provider. All current finance operations не обязаны стать SERIALIZABLE; необходимые writers получают control protocol, сохраняя свои прежние уровни изоляции.

## 8. Точная последовательность применения

Предлагаемые API: outer `apply(command, trustedPrincipalReference)` и inner `applyWithManager(manager, trustedPrincipalReference, command)`. Только outer владеет transaction/retry. Inner требует same DataSource active SERIALIZABLE; никакой nested transaction/commit. Existing post/postWithManager не меняются.

Command содержит stable commandKey, requestId, approvedDecisionId, candidateHash, expectedBaseVersion, expectedOperationVersion, contextId. Не принимает изменяемые деньги, participantId/role, live bank credentials или новый candidate после approval.

1. Snapshot/validate complete command до await, canonical material hash и schema. Retry envelope неизменен.
2. Начать новую SERIALIZABLE transaction на primary. Никаких бизнес-чтений вне неё как доказательства допуска.
3. Authorization gate + epoch; trusted apply right, verified executor participant/context. Список bank/lot ресурсов собрать и затем повторно подтвердить под locks.
4. Scope/identity/op → lot/control → receipt/request/candidate/decision/head по §7. Changed planned mapping → abort/replan, не lower-order дозахват.
5. Проверить trusted requester identity и независимость executor также для application replay, затем prior command key/semantic applied record. Exact historical success → replay (§10). Mismatch → conflict. Replay не проходит повторное применение.
6. Для NEW apply: requester identity проверена; executor независим; approved reviewer независим; exact candidate binding не NULL; bank state eligible и version=approval=expected.
7. Trusted candidate source proof и policy validity; geometry/origin fingerprint matches root. Any held coverage lot → block. Unknown financial dependency или already recognised source/obligation → отдельный correction workflow, не metadata shortcut.
8. Head version/hash exactly approved base; no successor conflict; request/decision ещё не использован. Читать original/effective metadata под общими locks; не брать reason-only approval вместо exact candidate.
9. Append applied full snapshot/result, UPDATE head CAS, increment lot control generation в этой transaction. Deferred constraints завершают integrity. Никаких UPDATE original part или ledger/outbox writes.
10. Outer commit. Только после подтверждённого commit возвращать окончательный success. До него результат inner provisional.

Текущие stateWithManager/reviewWithManager 8-Б вызываются **в отдельном READ COMMITTED review workflow**, не внутри apply. Apply использует новый locked validator bindings/current op непосредственно через его SERIALIZABLE manager. Не обходить READ COMMITTED guard старого сервиса и не менять его silently.

## 9. Bounded retry, ошибки и rollback

PostgreSQL рекомендует повторять полный transaction вместе с логикой выбора SQL/значений при serialization failure, а другие SQLSTATE требуют отдельного разбора. См. [PostgreSQL 17: Serialization Failure Handling](https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html).

**ТЕХНИЧЕСКИЙ ПРОЕКТ retry policy:** config `maxAttempts=N`, N положительное конечное целое и включает первую попытку; общий deadline, capped backoff/jitter. Значения N/deadline/delay здесь не назначаются. Нет валидной bounded config → executor disabled. Все ожидания между попытками, после rollback/release connection и locks.

- SQLSTATE 40001 при statement или commit: полный rollback, fresh transaction/snapshot, current auth/evidence/coverage/base checks заново; same key/candidate/request/decision/base expectations.
- 40P01 не автоматически маскировать: diagnose lock-order; отдельное явное разрешение bounded deadlock retry, не бесконечный цикл.
- 23505 не retry вслепую: fresh authenticated lookup stable key/decision/base; exact prior success → replay, несовпадение/другая successor → conflict. Возможность replay resolution не создаёт нового apply.
- Business denial (no approval/self/evidence/coverage/stale binding) не автоматический retry. Требуется changed approved facts или новое owner-authorized действие, не новый случайный key.
- После N/deadline: definite failure/retry_exhausted только если rollback подтверждён; не success. Несекретная audit/diagnostic reason, история денег нетронута.
- Unknown commit/connection loss: сначала проверить stable application key на primary в fresh transaction. При подтверждённом результате replay; если судьба transaction ещё неясна, ожидание сверки, не заявлять rollback и не отправлять независимую новую команду. Внутри этой операции никаких внешних платежей нет.

Не использовать independent post(), partial savepoint retry или отдельный commit для applied/head. Ошибка после version INSERT, после head UPDATE или на deferred commit откатывает version/head/control вместе. Диагностика failed attempt вне aborted transaction не является durable financial action и не пишет outbox.

## 10. Исторический replay и последующий отзыв

Historical result: applicationId/appliedVersionId, rootPartId, requestId, approvedDecisionId, candidateHash, applied version, immutable metadata snapshot/hash, geometry fingerprint и recordedAt. recordedAt — время записи, не точное время внешнего commit. Только подтверждённый commit разрешает вернуть success. Replay возвращает исходные IDs/суммы, replay=true, текущие bank blocking reasons/currentVersion/superseded отдельно.

Same key changed material → conflict. New key for already used exact approved decision/request → семантический replay исходного применения, не новая версия. New proposal другого request по той же old base после successor → stale/conflict.

После revoke: applied version остаётся исторически committed; replay не отменяет её, не снимает hold и не применяет снова. current blocked=true; receipt registration по-прежнему BANK_EVIDENCE_BLOCKED, coverage replay сохраняет прежнюю policy. После restore current bank state может eligible, но old approval version не становится допуском новой операции.

Replay requires current scoped authorization/verified identity. Если права отозваны, отдельный authorized read-only history путь, а не bypass application checks. Historical replay не обязан заново проходить когда-то выполненный zero-coverage gate: новый hold может существовать после apply. Оно лишь сообщает актуальный application-blocking context, не разрешение вновь изменить классификацию.

Любой result помечает отсутствие spend authorization; даже fresh success не разрешает использовать деньги без отдельного актуального evidence/coverage/economic gate. Effective metadata consumer читает head и current trust под своей transaction, сохраняет used version; historical result не заменяет такое чтение.

## 11. Конкурентные порядки

| Гонка | Допустимое завершение |
| --- | --- |
| Два apply same key | Один commit, другой 40001/retry→exact replay; не две версии |
| Два different requests same base | Один successor, второй stale/conflict; no last-write-wins |
| Coverage-first commit после старого apply snapshot | Changed lot control → abort/retry, fresh attempt sees hold→block |
| Apply-first, coverage waits | Apply commit, затем обычный reserve; не атомарное combined recognition и не own-free |
| Revoke-first | Op version/state change → 40001 либо verified blocked/stale на fresh attempt |
| Apply-first, revoke waits | Applied history сохраняется, subsequent trust blocked, no undo/release |
| Restore-first | Old approval bank version invalid; нужен новый exact independent review |
| Permission revoke after snapshot | Auth epoch конфликт/отказ на fresh attempt |
| Новая disjoint classification receipt | Original footprints unchanged; root guards сохраняются, нет повторных пенсов |
| Failure mid-apply | Full rollback, нет orphan applied/head/control |

Locks задают порядок commit, а control versions не допускают false stale-snapshot успех в mixed isolation. Допустимый последующий reserve не отменяет историческое исправление, но coverage запрещает следующее применение.

## 12. Инварианты и бухгалтерская граница

1. Money fingerprint root/receipt/lot неизменен; versions не новые суммы.
2. Original footprint участвует в overlap/capacity один раз, независимо от числа версий.
3. Lot restricted, отсутствие own-free/revenue/user obligation creation.
4. Any lot coverage блокирует NEW apply; replay никогда не release.
5. Исторические user/seller obligations и защищённые резервы сохраняются; recognised/dependent source не исправляется metadata shortcut.
6. Current candidate/base/proof/approval/executor identities должны совпасть атомарно.
7. No historical NULL participant or unbound approval activation.
8. Ровно один successor/применение approved decision; head восстанавливается из immutable history.
9. Accounts/journals/postings/outbox до и после metadata apply идентичны.

Receipt £10 остаётся Dr company_bank_cash 1000p / Cr unallocated_received_funds 1000p. Label change не повторяет bank receipt и не переводит suspense в platform income. Company_funding category не признаёт свободные собственные средства.

B66 80/20, 80/20, 50/50, 0/100 и M>0/cost trust/cash/no-double-reserve/budget сохраняются для новых economic operations. Metadata apply не запускает split и не разрешает доход вместо этих gates. Existing claims/mandatory accounting corrections не аннулируются из-за M. Денежная correction имеет отдельное legal/accounting основание и adjusting journal, вне этого проекта.

Outbox пока journal-only с обязательным journalId. Version rows — local immutable audit. Не создавать dummy journal, новый банковский command или delivery worker. Future metadata delivery требует отдельного расширения typed events, не параллельной денежной истины.

## 13. Тестовая матрица будущей реализации

Это план, не выполненные тесты. PostgreSQL — только identity-confirmed isolated finance DB; primary application DB/Docker volumes не используются для изменений.

| ID | Сценарий | Критерий |
| --- | --- | --- |
| A01 | Bound approved candidate, same base, free lot, SERIALIZABLE commit | Одна версия/head, immutable original и деньги |
| A02 | Нет/rejected/reason-only approval | Отказ; old approved не apply-ready |
| A03 | Candidate/base/hash/proof подменены после approval | Conflict/denial, никакой новой версии |
| A04 | Requester applies другим actor/service account | Same participant denial |
| A05 | Self-review/NULL identity/role-only apply/default provider | Deny, no fallback |
| A06 | Bank stale version/eligible false/revoke | Отказ без side effects |
| A07 | Approve→revoke→restore→apply | Old approval invalid; fresh current bound review требуется |
| A08 | Any held coverage, включая blocked synthetic и partial lot | New apply denied, allocations unchanged |
| A09 | Two same-key applies | One version, exact replay после допустимого retry |
| A10 | Two different requests same base | One successor; другой stale/conflict |
| A11 | RC coverage commits после SS snapshot до lock | Real 40001/fresh coverage block, не stale zero success |
| A12 | Apply-first / coverage-first реальные barriers | Правильный commit order, no release |
| A13 | Apply/revoke оба порядка; restore concurrent | История либо отказ, never trust bypass |
| A14 | Auth right/participant validity change after SS snapshot | Epoch conflict/current denial |
| A15 | Missing control/old writer bypass | Fail closed; apply не включается при unsupported protocol |
| A16 | Forced 40001 на statement и commit | Whole txn retry same material, fresh checks |
| A17 | Exhausted N/deadline/backoff config absent | Definite failure/disabled executor, no infinite retry |
| A18 | 23505 exact duplicate vs different material; 40P01 | Replay/conflict/diagnosed error, no blanket retry |
| A19 | Unknown commit and key reconciliation | Stable historical outcome, no duplicate application |
| A20 | Error after version/head/control, deferred failure | Complete rollback всех трёх |
| A21 | Replay after revoke/restore/later revision/new coverage | Original IDs/snapshot; current blocked/superseded, no writes |
| A22 | Same key changed params/new key same decision | Conflict либо exact semantic replay |
| A23 | Attempt change GBP/amount/offset/receipt/lot | Reject before apply; money fingerprint unchanged |
| A24 | Raw SQL forged head/fork/unbound decision/malformed candidate | FK/UNIQUE/deferred guards fail; auth не заменяется SQL |
| A25 | UPDATE/DELETE/TRUNCATE history/rebuild head | History immutable; projection rebuild exact |
| A26 | Fresh entire migration chain и реальные deferred commits | Исполняется итоговый trigger body, не только SQL text |
| A27 | Original classification/correction/coverage regressions | Existing API policy и lock ordering сохранены |
| A28 | Ledger/outbox/accounts/coverage snapshots до/после | Exact monetary invariance |
| A29 | Unknown legal/dependency/payout hold | Fail closed; existing claims не списаны |
| A30 | Different category 80/20→50/50→0/100 | Metadata only, no recognition/B66 bypass |

Гонки минимум двумя соединениями с pg_blocking_pids; отдельно snapshot-before-wait, mixed RC/SS, multi-lot controls и permission change. Promise.all/timers без доказанного blocking недостаточны. Unit покрывает canonical hashes, identities, retry bounds/manager ownership; integration проверяет DDL→DML→commit/rollback и все constraints.

Предыдущий deferred NEW-shape дефект исправлен follow-up 1791895100000; новые schema upgrades должны прогонять обе исходные таблицы и новые applied/head constraints через настоящий commit. Прежние 157/39 passes не acceptance apply.

## 14. Риски и решения до реализации

| Вопрос | Рекомендация / статус |
| --- | --- |
| Exact metadata approval отсутствует | Attachment + bound new independent decision; existing request/decision system сохраняется. Требует согласования |
| Old approved current version мешает fresh binding по UNIQUE | Новая linked request в той же таблице, no rewrite/constraint weakening. Требует согласования |
| Mixed isolation freshness | Shared lot generation + compatible writer changes до apply. Technical migration plan на утверждение |
| Trusted authorization epoch/proof validity | Adapter обязан transactional freshness; иначе production deny. Не утверждать существующий provider способен на это |
| Reviewer также executor | Owner утвердил независимость от requester; дополнительное separation выбрать отдельно |
| Retry N/deadline/backoff | Явная finite config, без произвольных значений в спецификации |
| Current rights/proof/policy change после approval | Fail closed revalidation; точные invalidation rules утвердить |
| Financial dependencies/source consumers | Сначала isolated no-recognition context; real integration только после dependency model |

Неизвестные partner windows, комиссии, safety резерв или тарифы не назначаются. Эти вопросы не причина изобретать новый бизнес split или отменять старые liabilities.

## 15. Минимальный безопасный порядок реализации

1. **Сначала подготовка точного approval:** candidate attachment и binding к existing decisions; старые approvals non-applicable. Production deny, no apply. Миграции только в проверенной finance test DB.
2. **Подготовка concurrency:** sidecar lot control/version и все coverage insertion guards/service paths; trusted auth epoch protocol; no amount/coverage changes. RC writers могут остаться RC. Прогнать mixed isolation regressions до включения apply.
3. **Isolated apply:** metadata-only versions/head, separate apply right, SERIALIZABLE outer executor/inner manager + bounded retry, без AppModule. Все A01–A30 и денежные snapshots.
4. **Позже отдельно:** effective metadata read compatibility для экономических consumers, production auth/source evidence hardening; no automatic module activation или real banking.

Возможные будущие finance файлы: candidate/apply contracts/entities/service/authority extension, control helper, additive migrations и isolated test runner. Минимально необходимые изменения затронут existing correction review для exact binding и CoverageService/DB guard для controls. FinanceService/post/outbox не требуют metadata изменений. Применять только после отдельного разрешения; обнаружение нужды менять старые business modules/tables означает остановку.

## 16. Контроль выполненного этапа

Создан только `work/finance-6v5-8C-classification-apply-design.md`. Existing specs/designs/report, source, migrations, tests, frontend сохранены. На этом этапе не запускались unit/integration/build, Docker/Compose, migrations или DB commands. Нет доходов, начислений, выплат, own-free или изменения allocations. Commit/push/pull/fetch не выполнялись; FinanceModule не подключён.

Выполнены локальное чтение и статические Git/Markdown проверки, дополнительно прочитана официальная PostgreSQL 17 documentation для transaction design. Это не банковское подключение. Финальная сверка: SHA-256 229 исходных файлов совпали, новых src/test-finance файлов нет; main/HEAD/status сохранены, staging пуст. Markdown UTF-8, git diff --check и no-index whitespace без ошибок; только предупреждение Git о возможном будущем LF→CRLF. После отчёта — остановка до разрешения.
