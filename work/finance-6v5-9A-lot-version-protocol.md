# Cashback+ — 6В.5.9-А: общий lot-version protocol

Дата: 14.10.2026. **DESIGN ONLY. Финальный проект технического контракта v2 на утверждение; не реализация и не разрешение миграции.**

## 1. Источники и границы аудита

Изучены `BUSINESS_SPEC_6B_FINAL.md`, проекты 8C и 8D, отчёт `work/finance-candidates-validation-a824ff6c83ef4f29b0717e547f154ce7/report.md`, сервисы/entities/миграции receipts, evidence, coverage, classification, corrections/candidates/decision history, ledger/outbox и authority interfaces.

Исторические результаты 8-Г: 173 unit/53 PostgreSQL passes. Они не доказывают lot-version, mixed-isolation или apply: этих механизмов в коде нет. На данном этапе БД/Docker не опрашивались, проверки уровня изоляции runtime не выполнялись.

Preflight: main, HEAD `1bb6cc792e320466e1b6473d6d7cadcb5ad2a8a9`; staging пуст; известные `?? src/finance/`, `?? test/finance/`. Новый документ отсутствовал. FinanceModule отключён от AppModule, production authorities default deny.

Бизнес-правила не меняются: GBP/целые пенсы; protected reserves/claims сохраняются; no automatic own-free; B66 M>0 для новых экономических операций, не запрет фактического receipt/mandatory correction. Apply/release/реальные выплаты этим проектом не включаются.

## 2. Наблюдаемая модель состояния

`finance_funding_lots` — immutable origin: один receipt/lot той же суммы, status=restricted, purpose=awaiting_classification. Ни state blocked, ни availablePence в lot сейчас не записываются.

Trust вычисляется из `finance_bank_operations.state/version`: revoke/restore меняют operation и увеличивают её version. Historical held coverage остаётся; возврат trust не снимает allocation.

Synthetic coverage capacity сейчас `lot.amountPence − SUM(all held allocations)`, без диапазонов. Classification capacity — receipt amount минус original disjoint parts. Это разные ограничения, не два независимых денежных кошелька. Candidate/review metadata не признаёт доход или свободные средства.

Generic ledger account balance не определяет свободный остаток lot и не заменяет его origin/coverage/obligation ограничения. Новый guard не хранит денежные суммы, trust bool или юридический статус.

## 3. Инвентаризация существующих путей

В таблице «caller» означает активный manager, но isolation не проверен методом. Обычно DS использует default PostgreSQL, однако фактическая сессия в этом design этапе не проверялась. Нельзя объявлять все эти методы READ COMMITTED только по прежним тестам.

| Путь | Чтение/изменение и текущий порядок | Isolation / риск / v2 роль |
| --- | --- | --- |
| BankReceiptsService.registerWithManager NEW | auth/scope/identity через verifier → operation; accounts validation → ledger key 726402/accounts → receipt INSERT → lot INSERT → receipt binding operation UPDATE | Caller. Создаёт lot; private-new-row исключение необходимо. Нужен атомарный control genesis |
| registerWithManager replay | bank locks/proof → receipt+lot lookup → bindReceipt; no new journal/outbox/lot | Caller. bindReceipt сейчас UPDATE-ит operation даже при той же receiptId; может давать MVCC conflict без business-version change. Control generation не bump при semantic no-op |
| EvidenceService.observeWithManager | auth 726405 → scope 726404 → observation/event INSERT | Caller. Нет canonical mapping/lot. Quarantine не блокирует весь account; no lot guard/bump пока нет связи |
| approveWithManager | auth/scope/identity → observation FOR UPDATE → operation FOR UPDATE/INSERT → bank decision/event | Caller. Observation сейчас берётся до operation. При существующем mapped lot добавляет trust evidence; v2 prelock lot/control и conservative bump такого mapped audit change |
| operation/verifyWithManager | discovery facts → auth/scope/identity → canonical operation FOR UPDATE; verify checks state/facts/decision | Caller. Только bank trust, не capacity/spend. Нужен current state под lot-context для lot-dependent действия |
| bindReceiptWithManager | verify опять под bank locks → operation receiptId UPDATE | Caller. Attach genesis; при replay тот же binding не новый cash/lot/version |
| revokeWithManager | auth → bank operation helper/row → verify basis → UPDATE state,version → evidence event | Caller. Lot rows сейчас не берёт; blocked — overlay bank state. v2 lock associated lot/control ДО mutation; bump atomically |
| recheckWithManager | auth/bank operation → observation read → trusted proof → restore-review INSERT | Caller. Не restore; lot trust не меняется, audit связанного origin консервативно bump в v2 |
| restoreWithManager | auth/bank operation → current independent review read → state/version UPDATE → event | Caller. Не release; v2 associated lot/control before mutation, atomic bump |
| inspectLotEvidence/assertLotEvidence | lot→operation discovery → bank operation locks; returns blocked/assert refusal | Caller. Сейчас lot/control не lock-ит. V2 decision reader получает full LockedLotContext; не spend authorization |
| historyWithManager | auth → operation/events SELECT | Caller. История не permission/use decision; standalone audit read не требует lot lock, response historical |
| CoverageService.createTargetWithManager | auth/trusted grant → mandate FOR UPDATE → target key/id FOR UPDATE/INSERT | Caller. No lot amount use/allocation. V2 admission, no lot bump, нельзя после target locks дозахватывать lot для reserve в этой же orchestration |
| reserveWithManager | auth → ВСЕ scopes/identities → operation rows → inspect helpers → ВСЕ lots FOR UPDATE → mandate → target → sums lot/mandate → reservation/allocations INSERT → target reserved | Caller. Настоящий capacity writer/reader; no shared mutable lot row сейчас. V2 controls между all lots и mandate; allocations bump |
| reservation replay | те же bank/lot/mandate/target locks; original result + current blocked | Caller. No allocation writes. V2 fresh guarded read, no generation bump |
| assertReservationUsableWithManager | auth → reservation/allocations discovery → grant + prelock bank origins → mandate | Caller. Сейчас нет lot FOR UPDATE/control и capacity recomputation. Это лишь future trust/mandate gate. V2 full lot-context, не разрешение spend/release |
| ClassificationService.classifyWithManager | auth → receipt/lot discovery → bank inspect → lot → receipt → original parts/ranges/sum → root/parts INSERT | Caller. Range/capacity writer; v2 control до receipt; original immutable guards сохраняются |
| classification replay | original result + current bank blocked, no parts INSERT | Caller. V2 current lot-context, no bump |
| requestCorrectionWithManager | delegate → separate auth → bank op → lot → receipt → request INSERT/replay | Явный READ COMMITTED. Review metadata writer, не capacity; v2 same guarded context, conservative metadata bump только new rows |
| CorrectionsService.lockRequest/state/review | auth → bank/op → lot → receipt → request FOR UPDATE → decision read/INSERT | READ COMMITTED. Participant/ancestry independent, op version. V2 controls before receipt; fresh decision/audit bump, state read/replay no bump |
| CandidatesService.link/create/review | separate auth → request locks как выше → original part/base → candidate/decision locks/INSERT | Через helper READ COMMITTED. No application. V2 conservative metadata bump; root/ancestry immutable и cross-request indices сохраняются |
| FinanceService.post/postWithManager | event key 726402 → accounts sorted FOR UPDATE → journal/postings/seal | post own transaction; inner caller. No lot identity/capacity. Нельзя использовать generic post как самостоятельный lot spend; future origin-aware writer берёт lot guards ДО ledger |
| FinanceEventsService.postEventWithManager | ledger → outbox under same manager/event lock | Caller. Lot protocol не создаёт outbox для metadata; ledger-only API совместим |
| release/reallocate/consume/impairment/apply | Executable paths отсутствуют | Future-only; обязаны войти в v2 до реализации. No current release/own-free API |

### DB writers и triggers, которые нельзя пропустить

- AddBankReceipts: lot_matches BEFORE INSERT, receipt_complete deferred, immutable receipt/lot. Требуется control genesis + deferred existence/parent consistency, не weakening originals.
- AddEvidenceControl: operation_guard/version/evidence events и receipt binding checks. Сейчас state-changing UPDATE не bump-ит lot guard, которого нет.
- AddSyntheticCoverage: allocation_guard берёт global auth, проверяет operation state, затем lot→mandate→target и sums. Он **не повторяет полный** service scope/identity/operation prelock; читает state до lot lock. Под coarse gate это existing path, но не final standalone mixed-isolation guarantee.
- AddReceiptClassification/FixCompleteness: part guard auth→scope→identity→operation→lot→receipt→bounds/overlap/sum; deferred completeness root/part. V2 добавляет control в правильном месте, сохраняя fix NEW-shape.
- AddCorrectionReview/AddCorrectionCandidates: bank/lot/request guards, exact binding/ancestry и cross-request UNIQUE. V2 metadata mutation hooks/control-context admission должны покрывать legacy и exact ветви, без backfill approvals.
- INSERT/UPDATE прямым SQL и implicit FK/trigger locks тоже writers. Нельзя ограничиться заменой TypeScript SUM. Privileged DBA bypass не покрывается контрактом; runtime permissions должны ограничить допустимые entry paths.

## 4. Единый lot guard и version vector

**Проект:** `finance_lot_control_versions(lotId uuid PK/FK, generation bigint NOT NULL CHECK>0)`. Новый entity/helper; никаких amount/available/blocked/purpose полей. Lot/receipt/operation origin не перемещаются.

Отдельный `finance_protocol_state` singleton с protocolVersion/closed|enforced нужен для admission/cutover, не финансовых calculations. Trusted auth epoch используется только при согласованном локальном provider freshness contract; иначе production deny.

Транзакционный guarded token:

`{ protocolVersion, lotId, generation:string, operationId, operationVersion, state, authEpoch, transactionContext }`.

Generation, bank version, approval base и auth epoch не взаимозаменяемы. Lot generation может измениться из-за новой metadata или allocation, не требуя автоматически нового bank approval. Новый bank version после revoke/restore требует fresh independent review по утверждённой policy. Generation — сигнал reread/re-evaluate, не причина отменить legal claim.

API проектного `LotProtocolService`: collect immutable origin set; acquire ordered context(manager, sorted resources); readValidatedState(context); assertStillCurrent(context); mutation uses DB bump hooks. Поддерживает same DataSource active manager, хранит контекст только внутри одной transaction, очищает при commit/rollback. Reused QueryRunner нельзя считать той же transaction; tokens не сериализуются и не принимаются от клиента.

Никакой ленивой вставки отсутствующего control в existing-lot reader. Missing/duplicate/orphan guard или unknown protocol version → fail closed. Expected generation из внешнего optimistic command, если такой контракт введён, не переписывается silently; внутренний observed generation собирается заново при каждом fresh retry.

## 5. Точный порядок блокировок v2

1. Admission/global auth `(726405,0)` — прежде чем любой существующий business row lock; protocol enforced и trusted rights.
2. Trusted authorization epoch row при наличии такого adapter. Remote auth/bank I/O под locks запрещён.
3. ВСЕ scope guards 726404 в canonical порядке.
4. ВСЕ identity guards 726403 в canonical порядке.
5. Только evidence-approve ветвь: нужные observation rows sorted; затем ВСЕ canonical operation rows sorted. Это сохраняет фактический observation→operation порядок approve. Новые ветви не берут observation после operation; recheck использует immutable observation read без нового lock.
6. ВСЕ существующие lot rows sorted FOR UPDATE.
7. ВСЕ соответствующие control rows sorted FOR UPDATE; mandatory row/version checks.
8. Branch rows: coverage — mandate→target→reservation/allocations; classification — receipt→classification/parts; correction — receipt→request→candidate→decision→future head. В каждом уровне stable UUID order. Shared rows при combined command собираются заранее.
9. Только денежные operations: ВСЕ ledger event keys 726402 sorted, затем accounts sorted. Metadata/review/lot counter не берут ledger и не создают journal/outbox.
10. Persist mutation + authoritative bump, validate deferred invariants, outer commit.

Текущий multi-scope collector сортирует значения scope/identity. V2 спецификация collector должна дедуплицировать **фактические advisory keys** и сортировать namespace/key, чтобы hashtext collisions не дали разных порядков при будущей оптимизации. Этот collector вводится одновременно во всех multi-resource paths на cutover, не только в новом apply. Пока общий global gate сериализует writers, collision главным образом добавляет contention; удалять gate без нового доказанного дизайна нельзя.

Discovery reads до locks — только план ресурсов, не proof eligibility. Mapping изменился или нужен новый более ранний guard → whole-command rollback/replan. Нельзя вызвать per-lot helper по произвольному порядку, когда ещё не собраны все scopes/identities/lots. Обёртка не вызывает сама себя через EvidenceService.inspect: нужен bank-only primitive и уже prelocked lot-context, иначе появится recursive/late prelock.

## 6. Владелец generation bump и критерии mutation

DB trigger/function — единственный владелец bump. Service **prelock-ит** все guards до branch locks, но не делает второй duplicate increment. SQL hooks работают на уже допущенной transaction с тем же parent context. One persisted affected row mutation может дать один bump; несколько rows одного lot могут дать несколько. Это monotonic generation, не счётчик commands/events; гарантия — хотя бы один increment при committed predicate-changing mutation.

| Mutation | Bump |
| --- | --- |
| New lot genesis | Control создаётся с generation=1; baseline, не историческая финансовая операция |
| Bank receipt binding существующего origin меняется | Associated guard bump; initial private genesis binding согласовано с receipt transaction |
| Evidence revoke/restore/state/version, mapped evidence decision/recheck audit | Associated lot bump, без изменения restricted amount/coverage |
| Coverage allocation INSERT; future lifecycle release/retarget/spend | Каждый affected lot bump; all lot guards prelocked |
| Original classified part/root факт создаётся | Lot bump; no bank cash change |
| Связанные с lot request/candidate/decision создаются | Conservative metadata bump; эти записи не расходуют capacity |
| Future applied version/head | Bump в общей transaction; apply пока отсутствует |
| Pure state/history/replay/matching receipt binding no-op | No semantic bump; результат не новые права |
| Observation без canonical mapping/lot, target creation без allocation | No lot bump; карантин не account-wide freeze |

Если два triggers относятся к одному metadata command, multiple bumps допустимы и документированы. Service не выводит event count из generation. Counter overflow → error/rollback, не wrap/reset. Delete control/reduction generation/truncate запрещены.

READ decision держит guard/op locks до commit; возвращаемый token valid только в текущей transaction. Read result/cache после commit не разрешает действие в другой transaction. Future действие должно заново получить context и проверить domain preconditions.

## 7. Receipt genesis: специальный совместимый путь

Текущий NEW receipt постит ledger до lot INSERT. Не брать locks существующего lot после accounts ради унификации: это был бы rank inversion.

Допустимый genesis путь: auth/scope/identity/operation prelocked → ledger key/accounts → создать PRIVATE receipt UUID + PRIVATE lot UUID + control row в той же transaction → bind уже prelocked operation → deferred receipt/control checks → commit. Новые строки ещё не видны другим sessions; insertion hook не блокирует и не читает произвольный existing lot/control или новые bank identities. Это исключение только для доказанно новых UUID/unique bank identity, не upsert существующего lot.

Control row insertion не требует уже committed bank receipt binding: deferred check к commit проверяет receipt/lot/control/canonical binding. Journal/receipt/lot/control/outbox откатываются вместе. Не ослаблять нынешний receipt-only Dr bank cash / Cr unallocated и no-double-recognition checks.

Receipt replay — existing origin: после bank verification prelock associated lot/control до любых downstream locks. Matching binding не новая mutation; рекомендуется устранить нынешний semantic no-op operation UPDATE отдельной finance правкой. Даже пока no-op tuple update существует, лишний serialization conflict не новое bank событие и не причина игнорировать retry.

## 8. Mixed isolation и freshness

V2 принимает READ COMMITTED readers/writers с ordered prelocks и future SERIALIZABLE apply. REPEATABLE READ/другие неподдерживаемые уровни fail closed до отдельного доказательства. Не менять старый correction RC-only guard втихую; SERIALIZABLE apply использует новый locked validator, не вызывает RC-only review service.

Advisory lock не обновляет snapshot SERIALIZABLE. Если RC writer после snapshot изменил predicate и guard generation, SS locking/updating guard получает changed-row serialization conflict и rollback. Fresh retry видит новые allocations/evidence/metadata. Не полагаться лишь на SSI одной transaction при остальных RC writers.

При отсутствии concurrent guard change SS snapshot подходит для guarded lot predicate, поскольку все relevant writers держат тот же context до commit и bump row. Independent participant/grant/proof validity относится к отдельному trusted auth/source version protocol; lot generation не аутентифицирует банк или человека. Нет provider guarantee → production deny.

Новое capability/control protocol можно проверить в isolated синтетической среде без activation real auth. Постановка readonly decision на standalone autocommit недопустима: lock release между SUM и mutation разрушает гарантию.

Повтор 40001: rollback всей transaction, fresh manager/snapshot/context, same business key/material, заново права/evidence/capacity/base. N/deadline/backoff конечны и явно конфигурируются после утверждения. 23505 различать replay/conflict; 40P01 отдельно расследовать lock order, не лечить бесконечным retry. Unknown commit сверить stable idempotency key на primary, не менять UUID и не объявлять успех/rollback без подтверждения.

## 9. Типовые конкурентные последовательности

### Coverage против future apply

- Reserve-first: R auth/bank/lot/control→mandate/target→capacity→allocation+bump→commit. A со snapshot до R пытается control lock/update → 40001 либо свежий observed guard; fresh A видит hold и NEW apply blocked.
- Apply-first: A locked validated evidence/candidate/no coverage/base, writes version/head+bump→commit. R ждёт global/lot guards, затем проверяет актуальный trust/mandate/capacity и отдельно резервирует. Applied history не отменяется; subsequent apply blocked при наличии hold. Ни одно действие не разрешает real purpose/own-free.

### Revoke против apply

- Revoke-first: op state/version+bump после prelock associated lot; A fresh проверка blocked/stale, либо 40001 если snapshot старый.
- Apply-first: committed version остаётся, revoke позже переводит trust overlay в blocked и bump; no DELETE applied/allocations, no journal reversal.
- Restore требует independent evidence policy и bank version++. Старый candidate approval не current, нужен новый exact review; guard generation не заменяет это правило.

### Два reserves / SUM против mutation

- Оба собирают все resources и lock lot/control до mandate/target. Первый INSERT+bump, второй после fresh check получает остаток/insufficient capacity. Multi-lot full coverage atomically all-or-nothing; mandate limit остаётся отдельным locked bound.
- Reader, который собирается изменить состояние, не отпускает guard после SUM. Если действие в новой transaction, заново locked read; старый token лишь optimistic expectation, не free capacity.
- Нельзя вычитать blocked hold или считать classification metadata освобождением. Future release/rebind требует отдельного approved lifecycle и bump обоих origin sets.

### Replay / rollback

- Receipt replay на revoked остаётся BANK_EVIDENCE_BLOCKED. Coverage/classification/candidate exact replay исторический с актуальным blocked/stale; no new allocations/parts/approvals/control bump.
- Evidence event replay может вернуть historical event result (нынешнее поведение), но actionable state только новым guarded read, не строка state из replay.
- Error/deferred failure/outer rollback откатывает domain rows и generation вместе; нельзя bump отдельной transaction. После retry того же key committed result не дублируется.

## 10. Deadlock аудит и совместимость

| Потенциальный цикл/обход | Требуемая защита |
| --- | --- |
| Target creation locks mandate/target, потом reserve берёт lot | Общая orchestration precollect+lot guards до branch locks; иначе отдельная transaction для createTarget, не автоматическая вложенная |
| Coverage service locks mandate, trigger затем впервые control | Prelock controls в service до mandate; DB guard не впервые берёт control late |
| Revoke UPDATE op перед сбором affected lots | Prelock current associated lots до mutation; op hook bump только уже known context |
| Approval observation→operation vs иной operation→observation | Сохранить observation phase перед op; остальные ветви immutable observation read, no reverse FOR UPDATE |
| Ledger primitive/accounts затем lot | Запрет existing-lot late lookup; genesis exception только private-new rows |
| Multi-scope per-lot helpers/hash collisions | Один full collector/canonical lock key ordering; gate остаётся |
| Raw UPDATE implicitly locks op before trigger берёт auth | Не использовать late trigger acquisition как допустимый entry; deny raw runtime DML, approved protocol entry до SQL mutation |
| FK/deferred trigger впервые захватывает parent/control | Prelock parents; deferred constraints проверяют consistency, не обнаруживают новые ранние resources |

RC candidate/review остаётся metadata-only; reason-only bindings NULL и cross-request unique indices не меняются. Existing post/postWithManager/ledger/outbox contracts сохраняются; counter bump без journal. Real origin-aware movements должны получить guards до generic ledger вызова.

DB guards не доказывают authorization/proof и не защищают от superuser. Transaction marker/version handshake может предотвращать accidental old-client access, но не является доказательством полномочий. Runtime privileges/approved stored entry wrappers должны исключать прямой обход; это отдельная production security проверка, не новая credential настройка этого этапа.

## 11. Инварианты v2

1. Каждый committed lot имеет ровно один control; lot/receipt GBP amounts остаются immutable.
2. Relevant committed mutation bump-ит все affected guards; aborted transaction не оставляет bump.
3. Control generation monotonic, не balance/state/approval version; no reset/backfill денег.
4. Decision reader locks весь origin set; no cached free-capacity authorization.
5. All writers, включая supported SQL path, используют одну admission/ordering/bump модель.
6. Held totals и mandate limits не превышаются; exact full synthetic targets сохраняются.
7. Classified footprints disjoint; multiple versions/candidates не повторные деньги.
8. Revoke/restore не release/own-free; existing obligations/reserves/history сохранены.
9. Exact approvals bank/base/fingerprint/participant-bound; generation update не retro-approval.
10. Pure replay/read не monetary mutation; future apply не разрешён одним token.
11. No metadata journal/outbox, no double cash recognition.
12. Не существует активного migration window с bypass writers.

## 12. Минимальные изменения и атомарный cutover

Будущие finance-only entity/helper: LotControlVersion, ProtocolState, LotProtocolService/context, canonical resource collector; additive migration/functions/triggers и isolated runner. Изменения нужны receipts genesis/replay, EvidenceService lot-related paths, CoverageService reservation/usability, classification, correction/candidate readers/writers и SQL guards. Generic ledger арифметика не меняется.

Рекомендуется **offline finance-only cutover**, а не постепенная live activation:

1. Проверить DB identity/все writer roles/entry points, migrations/schema, backups и baseline counts. Основная БД вне задания; первая будущая реализация только isolated finance DB.
2. Quiesce все finance invocations/test runners, включая прямые SQL writers. Module остаётся отключённым. Shared gate помогает drain, но не заменяет остановку uninventoried privileged sessions; сомнение → abort, не terminate/удаление данных.
3. В отдельной разрешённой migration transaction взять gate ДО DDL, создать controls/genesis hook и backfill **control rows generation=1**, не balances/approvals; закрытый protocol admission. Existing immutable rows не UPDATE-ить.
4. Одновременно установить ВСЕ mandatory mutation bump/check hooks, revised SQL guards, entry validation и runtime permission plan. Если любой путь не покрыт, protocol остаётся closed; migration failure rollback schema/data этой transaction.
5. Deploy только новый finance artifact с collector/prelocks и protocol version handshake. Old workers не запускаются. При сохранении older binaries DB admission/permissions должны отвергать их действия, а не доверять их старому SUM.
6. В isolated среде через approved v2 entry выполнить полный regression/concurrency suite, fresh migration chain/deferred commits. No bypass отключения guards ради тестов.
7. Атомарно перевести admission closed→enforced только когда schema+code+permissions complete. No old writer allowed интервал. Не импортировать FinanceModule/AppModule, production activation отдельна.
8. Проверить lots/control one-to-one, no orphans, unchanged protected money/claims/history; зафиксировать artifact/schema protocol IDs и результаты.

Protocol admission должен проверяться и на read-for-action, и на mutations. Нельзя поставить новый service feature flag, оставив old SQL inserts разрешёнными. Предпочтителен ограниченный runtime DB interface с approved entry procedures; ручной marker без privilege boundary не доказательство отсутствия обхода.

### Rollback-план

- До commit миграции: PostgreSQL rollback отменяет новые DDL/control backfill/hooks вместе; старые данные не очищаются.
- После cutover при дефекте: закрыть finance admission, остановить invocations, сохранить controls/history; forward-fix и повторить tests. Не откатывать только Node code на old writer при active guards.
- Не запускать исторический AddBankReceipts.down(): он содержит DROP lot/receipt, несовместимый с сохранением финансовой истории. Новая migration не должна иметь automatic destructive down/reset generation.
- Downgrade возможен лишь отдельным audited планом под полной quiescence и доказательством совместимости; до него closed fail-safe. Backup/volume restoration/удаление данных не часть этого плана.

## 13. Реальная PostgreSQL тестовая матрица

**План, не исполнение на этом этапе.** Все DB тесты только identity-confirmed isolated finance DB; без main schema/volumes resets. Минимум 2 connections, observer для pg_blocking_pids, barriers вместо timer/Promise.all-only. Для mixed test намеренно получить SS snapshot ДО RC commit/lock wait.

| ID | Сценарий | Проверка |
| --- | --- | --- |
| L01 | Receipt NEW/rollback/replay | 1 lot/1 control/genesis, no double ledger/outbox; rollback всех rows |
| L02 | New receipt конкурирует по bank identity, SS/RC | Unique bank receipt; no phantom/orphan control |
| L03 | Pure replay/read state | Generation не изменяется, historical/current semantics сохранены |
| L04 | Два RC reserves одного lot | Capacity bounded, один insufficient либо оба в пределах sum |
| L05 | RC reserve vs SS action со snapshot before RC | Changed control вызывает 40001, fresh retry sees allocation |
| L06 | SS action-first vs waiting RC reserve | Commit ordering, no double coverage/release |
| L07 | Revoke-first/apply-probe-first и restore | Op version + guard atomic, blocked/stale, history сохранена |
| L08 | Два lots/scopes reverse input, общий mandate | Stable order, exact full coverage, limit соблюдён |
| L09 | CreateTarget+reserve combined vs другие targets | No mandate-before-lot inversion; preplanned orchestration |
| L10 | Concurrent SUM reader/INSERT writer | Decision lock holds through mutation; stale-cache path rejected |
| L11 | Classification range insertion vs reserve/current-state read | Original capacity/range guards и shared generation |
| L12 | Candidates/linked requests/exact decisions | Monetary snapshot unchanged, metadata bump/ancestry/unique approvals |
| L13 | Revoke/candidate replay/receipt replay | Receipt denial vs historical blocked result, no duplicate mutations |
| L14 | Mapped approve/recheck vs revoke; unmapped observation | Bank/lot protocol respected, no account-wide quarantine bump |
| L15 | Ledger accounts contention + receipt genesis | No existing-lot late locks; private genesis no deadlock |
| L16 | Raw runtime SQL / forged marker / older writer | Permission/admission denial или mandatory full guard, не обход |
| L17 | Missing/duplicate/orphan control, reduced counter | Fail closed; no lazy repair/negative capacity |
| L18 | Error после mutation/bump, deferred commit failure | Both rows/counter rolled back; stable-key retry |
| L19 | Force 40001 statement/commit, exhaustion/unknown commit | Whole bounded retry/reconciliation; no success до commit |
| L20 | Force unsupported RR и autocommit/mismatched manager | Contract rejection, not stale success |
| L21 | Hash collisions/reversed resource sets, FK/deferred parent locks | Canonical ordering, no introduced 40P01 cycle |
| L22 | Permission/proof validity changes after SS snapshot | Auth/source epoch conflict/current denial, no lot-token substitute |
| L23 | Counter overflow/JS bigint serialisation | Failure rollback, no wrap/floating point |
| L24 | Closed migration / active older client / partial artifact | No bypass window; failure stays closed |
| L25 | Fresh complete migration chain + real root/part/control commit | Includes NEW-shape regression, not SQL substring tests |
| L26 | QueryRunner reuse after rollback/commit | Old context rejected, new transaction guard required |

Без реализации apply использовать isolated decision+test-only metadata mutation probe для L05–L07, не production apply и не новое financial obligation. Спецификация probe/его непроизводственное размещение утверждается с будущим testing заданием. Test success не разрешает реальные allocations/release.

Acceptance: все paths инвентаризации покрыты guard/admission; no DML capable unguarded runtime writer; controls count/origin match; old invariants/tests сохранены; deterministic conflict/rollback; no changed accounts/journals/postings/outbox при metadata-only phase. Не чистить историю, чтобы reruns проходили.

## 14. Открытые решения и минимальный следующий этап

Технический контракт v2 завершён, но требует утверждения до реализации:

- broad conservative metadata bump scope и DB-only ownership increment;
- offline closed/enforced cutover и конкретный runtime privilege/entry boundary;
- canonical advisory key order update во всех collectors;
- approved локальный authority/source freshness epoch adapter (production сейчас disabled);
- finite retry N/deadline/backoff и operational error policy; числа не назначены;
- размещение isolated concurrency probe без apply и допуска существующих writers;
- дополнительное reviewer/executor разделение, если требуется сверх уже утверждённой независимости от requester.

Не требуются новые split/margin/reserve/TTL/payout правила. Новые economic операции всё равно выполняют B66; потеря покрытия не прекращает уже возникшее обязательство.

Рекомендуемый 6В.5.9-Б: после разрешения реализовать v2 controls/admission и ВСЕ текущие paths совместно в inactive finance-only контуре, isolated migration + L01–L26, **без classification apply**, реальных выплат и AppModule. Раздельное внедрение одного CoverageService или только SS apply запрещено. После success отдельное задание на apply с exact candidate approvals и current guards.

## 15. Контроль DESIGN ONLY

Создан только этот документ. Source/migrations/tests/существующие specs/reports, DB/Docker/frontend сохранены. Unit/integration/build/migrations не запускались; фактической runtime DB проверки не было. Commit/push/pull/fetch не выполнялись; FinanceModule не подключён; нет начислений, income, own-free, выплат или release.

Финальная сверка: SHA-256 233 исходных файлов совпали, новых src/test-finance файлов нет; main/HEAD/status сохранены, staging пуст. Markdown UTF-8 и whitespace/git diff --check без ошибок; Git сообщил только предупреждение о возможном будущем LF→CRLF. Исторические 173/53 passes не lot protocol acceptance. После отчёта — остановка до разрешения.
