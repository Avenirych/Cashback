# Восстановление истории бизнес-логики Cashback+

Дата исследования: 20.10.2026. Результат: **BUSINESS_LOGIC_RECOVERY_BLOCKED**.

## 1. Результат для владельца

Найдены не только старые упрощённые сервисы, но и ранее разработанная финансовая подсистема, её тесты, миграции и подробная спецификация. Значительная часть этих материалов находилась **в незакоммиченных локальных копиях**, поэтому поиск лишь по Git и активному src не давал полной картины.

Важное уточнение к BUSINESS-LOGIC-AUDIT.md: отсутствие реального purchase/cashback/refund workflow в активном приложении подтверждается, но это **не означает отсутствия прежней разработки финансового ядра или документированных бизнес-правил**. Найдены `work/BUSINESS_SPEC_6B_FINAL.md`, архитектура этапа 6В.3, дальнейшее ядро 6В.5 и сохранённая исходная копия до исторического cutover.

Вместе с тем ни проверенные Git-ревизии, ни наиболее развитая найденная исходная копия не содержат готовой связанной реализации всех запрошенных покупок/частичных возвратов/взыскания после использования бонусов. Документы прямо называют незавершённые операции. Последние сервисы корректировок возвращают `applicationImplemented:false`: они фиксируют запрос/решение, а не выполняют денежную корректировку. Реальные authority/verifier по умолчанию запрещают операции; синтетические разрешения существуют для тестов.

По обязательному условию задания неизвестные критические правила не заменялись догадками. **В активный src ничего не переносилось, AppModule не менялся, миграции и deployment не выполнялись.** Полезные исходники сохранены в существующих копиях; ниже указаны их происхождение и способ последующего восстановления без подмены бизнес-модели.

## 2. Границы и охват поиска

Исследованы:

* Все доступные локальные branches и remote-tracking refs, tag и reflog. `git rev-list --all` — 123 коммита; с `--reflog` — **125 ревизий**. Stash list пуст.
* Для этих ревизий просмотрены деревья и выполнен поиск по **792 уникальным текстовым blobs** `.ts/.tsx/.js/.jsx/.mjs/.md/.sql/.json` (lockfiles и некоторые генерируемые JSON исключены из содержательного поиска). Использованы refund/partial refund/chargeback/reversal/purchaseStatus/orderStatus/возврат/отмена покупки/распределение бонусов, дополнительно пути и история cashback/transactions/balance/bonus/withdrawal/price-calculation.
* Ветки `main`, `improvement/profile-step-1`, `copilot/*`, `origin/main`, `origin/master`, `origin/copilot/*`, cutover/recovery; tag `finance-security-native-diagnostic-blocked-2026-10-16`. Remote refs — локально доступные; обновление GitHub/fetch не выполнялось. Не заявляется охват недоступных серверных веток, удалённых репозиториев или неизвестных внешних архивов.
* Текущее незакоммиченное дерево, `work/finance-*-validation-*`, `config-backups`, исторический worktree и сохранённая исходная копия в известном snapshot backup. Защищённые credentials, session secrets, SQLite/DB dumps как пользовательские данные не читались.
* Состояние Git проверено; HEAD остаётся `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`, рабочие изменения не сбрасывались. Исторический worktree не переключался.

Это поиск по всем перечисленным доступным источникам, а не доказательство, что иной рабочей реализации никогда не существовало. Для продолжения допустимо указать дополнительный commit/архив, содержащий недостающие domain operations.

## 3. Найденные ревизии и локальные источники

| Источник | Найдено | Что не следует из находки |
|---|---|---|
| `56053c5`, `d677b60`, `9022fdd`, `979b1fe` (28.09–03.10) | Старые balance/cashback/transactions/pricing сервисы и их изменения | Нет доказательства связанного исправленного refund workflow; ранний addCashback — прямое сложение balance и отдельная history save |
| `4e64a37`, `5a3e6aa6b65a` / UK-onboarding branch | Encrypted recipient, integer-pence balances, manual withdrawal reservation, исключение pending/reversed/non-GBP, integration specs | Не реализация purchase commission/refund; ручной вывод не Wise API |
| `e01c76b` (10.10) | Bonus snapshot, транзакционный forum transfer/idempotency, confirmed/pending/spent/expired | `spendBonusesOnPurchase` явно NotImplemented: нужны server orders/trusted pricing |
| `03573b7…` | Исторический application baseline | Не содержит подключённую полную финансовую цепочку; нынешнее дерево расширено локальными адаптациями |
| `92c8532` (13.10) | JWT owner-only Users API/safe DTO, отключение HTTP decorators legacy topics/posts | Защиты не полностью представлены в активном историческом приложении; это отдельный обязательный security review |
| `d1fcf89` (13.10) | Изолированная Docker test integration | Поиск не ограничивался этим коммитом или более поздним d14 |
| `d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f` | Bonus/marketing/forum/frontend demo, отдельный Express/SQLite bonus-api | AppModule не подключает полную commerce/finance цепочку; enum `refund` — не обработчик возврата |
| [BUSINESS_SPEC_6B_FINAL](../../work/BUSINESS_SPEC_6B_FINAL.md) | Собранные правила B01–B66 с последующими уточнениями, Q01–Q14 и открытыми деталями | Заголовок FINAL не означает утверждение всего документа: верхний статус «НА УТВЕРЖДЕНИЕ ВЛАДЕЛЬЦУ». Метки «УТВЕРЖДЕНО» — зафиксированная документом история решений, исходные сообщения здесь независимо не аутентифицировались |
| [Архитектура 6В.3](../../work/business-architecture-6v3-8c953bc583334a22b98d954a5ad94ca9.md) | Матрица правил/пробелов и этапы восстановления | Уже в ней перечислены нереализованные покупки, lots, refunds, payouts; более поздние дополнения specs имеют приоритет по смыслу |
| `work/finance-core-validation-*`, `finance-manager-*`, `finance-outbox-*`, `finance-receipts-*`, `finance-evidence-*`, `finance-coverage-*`, `finance-classification-*`, `finance-corrections-*`, `finance-candidates-*` | Последовательное ядро ledger → outer transaction manager → outbox → restricted receipts → evidence → synthetic coverage → classification → correction review → exact candidates | Это сохранённые локальные разработки, не Git commits и не доказательство production deployment |

### Основная сохранённая исходная копия

`C:\Users\serge\AppData\Local\Temp\cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15\project\src\finance`

Найдено **43 файла** с migrations и tests. Сравнено с:

`work/finance-candidates-validation-a824ff6c83ef4f29b0717e547f154ce7/src/finance`

Все файлы кроме `bank-receipts.spec.ts`, `coverage.spec.ts`, `README.md` совпали по SHA-256; эти три отличаются. Следовательно, нельзя объявлять весь validation snapshot идентичным backup, но исследованные service/money/migration файлы соответствуют ему. Backup содержит более развитую документацию corrections/candidates и отличающиеся тестовые правки.

Контрольные SHA-256:

* `money.ts`: `c6fd847ff61efbc1116f5c02dabb03ba89d29b28267448edffe87d1df0600aed`.
* `classification-candidates.service.ts`: `89951402899babe047da54502ad0d7672dee3998c6a2b2e4c79bc0332b2f1a4a`.

Это проверка исходных файлов, **не новая проверка восстановления БД из backup**. Исходная копия остаётся на месте, ничего из неё не удалялось.

## 4. Точные найденные формулы и распределение

Источники: `money.ts` и его `finance.spec.ts` в найденных копиях; BUSINESS_SPEC B01–B08, B61–B66. Проценты относятся к подтверждённому доходу/commission, не автоматически к цене товара.

| Источник дохода | Пользователь | Платформа до расходов | Исполняемая находка |
|---|---:|---:|---|
| Cashback | 80% | Остаток ~20% | `splitRevenue(total, 'cashback')` |
| Добровольная rewarded advertising | 80% | Остаток ~20% | `rewarded_advertising` |
| Research referral | 50% | Остаток ~50% | Не применять к любому вознаграждению за само исследование |
| Passive advertising | 0% | 100% | `passive_advertising` |

Внутренние деньги: bigint pence GBP. `gbpToPence` использует exact decimal и ROUND_HALF_UP: £0.005 → 1p. Для окончательного total G: `U=HALF_UP(G*r/100)`, `P=G-U`, поэтому сумма сохраняется точно. Для 1p research пользователь получает 1p, платформа 0p. `percentageOfGbp(value, percentage)` точно перемножает десятичные коэффициенты: £0.10 × 5% → 1p после округления. Это математическая примитива, не подтверждение комиссии продавца.

Документированные ограничения:

* Платформа признаёт долю только после подтверждения и фактического получения дохода, split однократный.
* `C` — полные достоверные относимые расходы, `M=P-C`; для всех четырёх новых экономических операций необходимы **M>0**, coverage, no-double-reserve и бюджет. Unknown C не считать нулём. Расходы не уменьшают U.
* Нельзя списывать существующее обязательство из-за недостаточной маржи/покрытия. Корректировки — новые записи, не переписывание прошлого.
* Подтверждённые реальные GBP/cashback по поздним B52–B58 **не сгорают**; дата происхождения сохраняется при переводах. Текущий demo BonusItem с expiresAt не удовлетворяет этому правилу и не должен быть молча переинтерпретирован.
* Документ различает доступные/резервные бонусы, GBP к выплате, debt и platform. GBP после покупки нельзя снова расходовать как bonus.

Не восстановлены как утверждённые точные входные данные: gross/net commission basis, fee/FX/tax attribution, единица округления внешних fractional receipts, финальное событие availability. Поэтому перенос одной split-функции не восстанавливает весь cashback.

## 5. Покупки, состояния и allocation

Документированные B11/B11a/B45–B51: резерв при переходе к продавцу, без произвольно назначенного TTL; связь user/offer/click/reservation/purchase; перенос при выборе другой покупки без двойного расхода. Один click может породить несколько заказов, cashback по всем подходящим подтверждённым/payable покупкам. **Bonus reservation применяется один раз к самому дорогому подходящему заказу**, order-level, а не к каждой позиции. Излишек сверх допустимой стоимости не списывается.

Не определены финальный cost metric, tie-break, partner reporting finality/window, late higher order, cancelled winner, пересчёт при partial return, точный момент освобождения и значение «выплата cashback» (partner receipt/GBP settlement/Wise payout). Q13 прямо запрещает считать highest-order selection полностью специфицированным до решения этих вопросов.

### Матрица переходов — доказано против неизвестного

Имена ниже — смысловые состояния из документов, **не найденный готовый enum OrderStatus**. Исполняемая purchase state machine не найдена.

| Откуда → событие → результат | Найденное правило | Готовый обработчик / блокер |
|---|---|---|
| Нет заказа → merchant click → reservation | Атомарный резерв до redirect, не двойной | Не найден orchestration/order schema |
| Click → несколько partner orders → набор кандидатов | One-to-many, cashback по всем eligible orders | Нет partner identity/event contract/finality policy |
| Pending → confirmation | Требуются достоверные partner facts; клиент сумму не назначает | Q01: точное финализирующее событие и доступность не определены |
| Confirmed → receipt → allocation | Однократный split, platform только received/confirmed | Есть arithmetic/ledger примитивы; нет business allocation processor |
| Reservation → winner allocation | Самый дорогой eligible order; один раз | Q13: metric/ties/late events/excess release |
| Pending/confirmed → cancellation | Сохранять историю; не считать отсутствие отчёта отменой | Нет полной transition matrix с основаниями |
| Allocated → full/partial refund | Корректирующая новая операция, cap obligation, no double reversal | Нет готового monetary handler; Q08/Q13 |
| Любое → повторный event | Не повторять движение | Ledger key/replay есть; canonical partner order/refund identity отсутствует |
| Любое → неверный переход | Fail closed, не менять деньги | Полный список разрешённых бизнес-переходов не восстановлен |

### Распределение cashback/bonus по покупке

| Сумма | Источник / назначение | Историческое правило | Наличие |
|---|---|---|---|
| Gross commission G | Подтверждённые/полученные partner funds | 80/20 + admission gates | Arithmetic есть, источник и posting orchestration отсутствуют |
| Reserved bonus | Ранее подтверждённые суммы с lineage | Только один winning order, частичное использование от 1p; повторно 20% не удерживать | Lots/slices/order linkage отсутствуют |
| User GBP | Cashback + допустимые attached bonuses после установленного settlement | Отдельно от transferable/spendable bonuses | Read model и завершённый settlement отсутствуют |
| Platform share | Остаток после rounded user share | Не начислять повторно при transfer/возврате distributed bonus | Ledger может записать проводки, business allocation отсутствует |
| Extra orders того же click | Их собственный commission cashback | Сохраняют 80% пользователя, даже без второго bonus allocation | Политика есть, исполняемой интеграции нет |

## 6. Отмены, возвраты, использованные и переведённые суммы

Источник: B09–B15, B49–B50 и Q08/Q09/Q13. Эти правила не следует заменять старой FAQ-фразой «бонусы вернутся»: она не описывает окончательный clawback/debt design.

| Сценарий | Найденное требование | Неизвестное / состояние кода |
|---|---|---|
| Отмена без доказанного clawback | Не угадывать освобождение/основание по timeout | Полная release policy до settlement не найдена |
| Продавец требует вернуть перечисленный cashback | Applied bonuses направить в покрытие долга, не в available; остаток долга отдельно; затем seller repayment | Полный размер obligation, fees/platform liability требуют Q08 |
| Полный возврат после allocation | Не переписывать журналы, новая linked correction, не взыскать сверх obligation | Исполняемого reversal/accounting workflow нет |
| Частичный возврат | Явная коррекция суммы/allocation без двойного использования | **Точная формула/база/округление/переоценка winner не определены**; пропорцию не назначать самостоятельно |
| Бонус отправлен другому участнику | Должником остаётся первоначальный отправитель; важна immutable lineage | Нет полноценной lineage модели/применения взыскания |
| У получателя свободная связанная часть | Можно зачесть прямо в debt отправителя, не в его доступный баланс | Алгоритм multi-hop/выбора частей требует уточнения |
| У получателя reserved или окончательно использованная часть | Защищена; получателя не делать должником; unrelated funds не трогать | Готового protected-lot collector нет |
| Защищённый резерв получателя освобождён без использования | В той же transaction проверить связанный свободный остаток для допустимого зачёта | Нет domain release+recovery transaction |
| Должник зарезервировал новую покупку | Допустимо уменьшение его резерва с атомарным пересчётом quote | Нет order quote/version orchestration |
| Новые поступления должника | Сначала разрешённое погашение долга; не double collect | Очередность нескольких долгов/допустимые средства Q09 |
| Средства уже выплачены Wise | Обязательство не исчезает; не выдумывать автоматический rollback внешнего платежа | Полная after-payout refund policy не определена |
| Повторный refund/callback | Stable identity, replay/conflict; предыдущий зачёт не взыскивать повторно | Ledger key есть; business refund canonical key и state machine отсутствуют |

Полная reconciliation должна включать conservation по lineage, balances=sum(postings), reservation/available/debt/paid и merchant obligation. Найдены ledger invariants, но не готовая проверка всех перечисленных domain totals после purchase/refund.

## 7. Что действительно реализовано в найденном финансовом ядре

* `money.ts` — exact GBP arithmetic и четыре split ratios.
* `ledger.ts`, `finance.service.ts`, `finance.entities.ts`, `1791890000000-CreateFinanceCore.ts` — сбалансированные debit/credit, journal event key/hash, replay/conflict, account locks, cached balances, DB guards/immutable history. `postWithManager` использует переданный активный EntityManager; commit/rollback принадлежит вызывающей domain transaction.
* `finance-event.ts`, `finance-events.service.ts`, outbox migration — типизированный **finance.journal.posted**, атомарный outbox с журналом. Это не список purchase-confirmed/refund бизнес-событий и не delivery worker.
* `bank-receipts.service.ts` — restricted receipts/lot; UUID/hash/receipt сам по себе не доказательство банка. Default verifier/authority deny.
* evidence lifecycle, synthetic coverage, receipt classification — отдельные защищённые примитивы. Classification не создаёт свободные деньги, доход, cashback или пользовательский долг.
* `classification-corrections.service.ts` — запрос/рассмотрение metadata correction; `classification-candidates.service.ts` — exact immutable candidate, base hash, независимое review, linkage/ancestry и cross-request uniqueness. Оба явно **applicationImplemented:false**. Это не partial refund handler и не completed monetary reversal.

Последние миграции найденной копии: `1791896000000-AddCorrectionReview.ts`, `1791897000000-AddCorrectionCandidates.ts`; предыдущие core/outbox/receipt/evidence/coverage/classification migrations также сохранены. README сообщает об их прежних испытаниях только на отдельной finance test DB и об отключённом FinanceModule. Эти прежние DB-применения сейчас не перепроверялись.

Нельзя включать default-deny authority с синтетическими тестовыми maps для production. Нельзя считать generic `postWithManager` готовым авторизованным financial endpoint.

## 8. История → текущая версия → метод восстановления

| Историческая возможность | Файлы/источник | Сейчас | Причина расхождения / безопасный метод |
|---|---|---|---|
| Exact split 80/20, 50/50, 0/100 | Local finance money/specs | Нет активного FinanceModule; магазин demo | Не перенесён локальный source при historical cutover; вернуть как отдельный проверенный модуль только с утверждёнными domain callers |
| Journal/transaction/outbox | Local finance core + manager/events + migrations | В active historical DB finance tables не установлены по предыдущему аудиту | Исходники сохранены отдельно; additive schema plan и runtime permissions, без импорта users.balance/demo credits |
| Restricted receipts/evidence/coverage | Local finance bank/evidence/coverage | Не участвуют в active application | Намеренно изолированы, live authority отсутствует; не просто «сломанный импорт» |
| Correction review/candidates | Local finance corrections/candidates | Отсутствует | Можно восстановить metadata workflow, но application всё равно не реализован; не объявлять восстановлением refund |
| Purchase/refund domain system | Spec + architecture | Нет ни текущего, ни найденного полного handler | **Нельзя классифицировать как удалённый готовый код без дополнительного источника**; нужны недостающие исходники либо отдельное решение реализации по завершённым правилам |
| Старые cashback/transactions/pricing | Git 56053c5…979b1fe, src/* | Файлы есть, модули неактивны, tables отсутствуют | Сохранены, но не вызываются; не включать: float/add-before-history, нет idempotency, две Transaction модели, pricing без /100 |
| Forum demo exchange | e01c76b/d14/current BonusModule | Активная отдельная demo ledger | Сохранить; whole-position/expiry не превращать молча в новые non-expiring 1p slices |
| Wise GBP manual reservation | 4e64a37/UK branch | Current local form, inactive old withdrawal stub | Иная линия разработки; не соответствует email-only automatic policy поздних specs; нельзя wholesale cherry-pick |
| Реклама | Исторический BonusAds | Browser animation + local counter | Не настоящее видео/доход; сохранить действующий UI, не приписывать подтверждённый partner reward |

Не обнаружено подтверждения dependency break как единственной причины. Основные причины: часть кода осталась в local backups, FinanceModule намеренно не был включён, domain functionality оставалась в проектировании; active historical schema не содержит финансового набора. Старые FAQ и demo UI не доказывают исполнение правил.

## 9. Тесты и совместимость

Новый запуск выполнен в **существующей изолированной исходной validation-копии**, не в active application и не в базе:

`work/finance-candidates-validation-a824ff6c83ef4f29b0717e547f154ce7`

Node/Jest `--runInBand --no-cache --runTestsByPath` с предварительной загрузкой существующего `test/offline-process-guard.cjs` из snapshot backup. Guard запрещает spawn/exec/execFile/fork и ChildProcess.spawn, включая импортированные helpers. Выбранные specs просмотрены на реальные connection/init/child-process calls: используют mocks. PostgreSQL runners `.cjs` не исполнялись.

**5 suites / 97 tests PASS:** finance.spec, finance-transaction.spec, finance-events.spec, classification-corrections.spec, classification-candidates.spec. Проверены арифметика/split/conservation, balanced postings, replay/conflict, отрицательные остатки/overflow, внешний transaction manager, event/outbox rollback, metadata correction authority/candidate invariants. Это не 97 тестов реальных покупок/возвратов.

Полная проверка найденного validation snapshot: `tsc --project tsconfig.json --noEmit --incremental false` — **FAIL**, 11 diagnostics:

```text
src/finance/bank-receipts.spec.ts(26,501) TS2532 possibly undefined
src/finance/coverage.spec.ts(27,377) TS18048 p possibly undefined
src/legacy-routes-security.spec.ts(70,24) TS7053 string indexing union
src/legacy-routes-security.spec.ts(80,32) TS7006 layer implicit any
src/legacy-routes-security.spec.ts(80,58) TS7006 layer implicit any
src/legacy-routes-security.spec.ts(81,81) TS7006 p implicit any
src/legacy-routes-security.spec.ts(90,62) TS7006 layer implicit any
src/marketing-preferences/marketing-preferences.security.spec.ts(132,38) TS7006 options
src/marketing-preferences/marketing-preferences.security.spec.ts(138,17) TS7006 data
src/marketing-preferences/marketing-preferences.security.spec.ts(139,21) TS7006 data
src/marketing-preferences/marketing-preferences.security.spec.ts(141,40) TS7006 type
```

Это старый validation snapshot: ошибки не приписываются активной версии и не скрываются успешным Jest. Два finance spec файла отличаются от backup; исправленные версии нельзя выбирать автоматически без review. Типы не ослаблялись, asserts не удалялись.

### Запрошенные бизнес-сценарии

| Сценарий | Результат проверки |
|---|---|
| Создание покупки, pending, confirmation, invalid transition | Не запущены: нет восстановленного domain handler/полной state policy |
| Commission calculation | Не доказана: нет trusted seller basis; процентная арифметика проверена отдельно |
| Cashback/bonus split | PASS как точная примитива, не сквозное начисление |
| Cancel/full/partial refund | Не реализованы как готовые найденные операции; формулу partial не выдумывать |
| Повтор confirmation/refund | Generic journal replay/conflict PASS; domain event identity отсутствует |
| Refund после allocation/partial usage | Нет lot/obligation/refund handler, не проверено |
| Financial history integrity | PASS для mock ledger/candidate invariants, не real DB/domain reconciliation |
| Balance reconciliation | Conservation/negative/overflow unit PASS; current balances не изменялись |
| Unauthorized financial operations | Default-deny correction unit assertions PASS; purchase endpoints не добавлялись, полного live authorization E2E нет |

Новые «regression tests» с выдуманными status/refund правилами не добавлялись. Они создали бы ложное доказательство бизнес-модели. Реальные PostgreSQL integration tests/fixtures, build/deploy не запускались после выявления критического policy blocker.

## 10. База, backup и условия безопасного переноса

Никаких SQL/DB connections в этом задании не выполнялось. Предыдущий read-only audit зафиксировал historical DB `cashback_historical_03573b7`, cluster `7698666936429441062`, OID 16384, container `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`, role `cashback_hist_runtime`; это **предыдущее наблюдение**, не новое подтверждение идентичности для migration.

Нет новой DB backup/restore проверки, потому что восстановление заблокировано до этапа изменения БД. Существующая исходная backup-копия прочитана и сравнивалась по hash; она не заменяет restorable database backup.

Будущий обязательный порядок, не выполненный здесь:

1. Закрыть подтверждённые legacy Users/Topics authorization risks; проверить реальные consumers, safe serialization и mass-assignment.
2. Найти недостающий complete purchase/refund source либо завершить policy Q01/Q04/Q08/Q09/Q13 и одобрить отдельную реализацию отсутствующих операций.
3. Зафиксировать точный выбранный локальный finance snapshot/patch с происхождением; исправить типовые несовместимости без ослабления тестов; FinanceModule пока отключён.
4. Повторно независимо проверить target cluster/container/database/runtime-role/schema, сделать restorable backup и trial restore в разрешённом отдельном окружении.
5. Сверить все найденные additive finance migrations с текущей схемой, extension/DDL requirements и минимальными grants. Не запускать их общий список вслепую: некоторые прямо предназначены только для synthetic coverage test стадии.
6. Новый реальный ledger не импортирует demo balances/SQLite/users.balance автоматически (spec B20). Сохранить existing bonus_items/forum/auth/profile/marketing; новый schema namespace и table mappings не должны конфликтовать с двумя legacy Transaction/BonusTransfer моделями.
7. Полные isolated PostgreSQL concurrency/idempotency/rollback/reconciliation tests для утверждённых domain rules, затем owner-approved deployment с rollback исходников/сервисов без удаления financial history или destructive down.

Сейчас нет обоснования применить схему к активной базе: известны будущие сущности orders/clicks/reservations/lots/lineage/obligations/allocations/refunds, но точный безопасный migration set зависит от нерешённых правил. Никакой existing financial record не переинтерпретирован.

## 11. Что восстановлено и что изменено

**Восстановлены знания и расположение исходников**, а не работоспособная интеграция. Найдены и проверены прежние формулы, документация, 43-file source set, migrations и mock tests. Ничего не копировалось в active src; не создан второй backend, не восстановлен standalone SQLite service.

Изменение задания: только `docker/historical/BUSINESS-LOGIC-HISTORY-RECOVERY.md`. Запуск Jest/tsc выполнялся в уже существующем ignored validation snapshot; application source/configuration/DB/services не изменялись. Существующие архивы сохранены. Старый аудит не перезаписывался: его ограничение по local finance history явно уточнено этим документом.

## 12. Конкретные блокеры и требуемое решение

1. **Нужен дополнительный источник готового кода**, если полностью исправленный purchase/refund workflow действительно был реализован в другом месте: commit/branch/путь архива с order handlers, lot lineage, refund application и их тестами. В проверенных источниках пока найдены спецификация и поэтапно незавершённое ядро.
2. Если такого источника нет, нужно отдельное решение владельца завершить отсутствующую реализацию на основе найденных правил, предварительно разрешив Q01/Q04/Q08/Q09/Q13: finality/availability, commission basis/costs, full/partial clawback liability, порядок частей/долгов, winner/ties/late orders/excess release. Ответ «использовать старые правила» не задаёт отсутствующие числовые/событийные условия.
3. Нужны trusted partner identity/event facts и production authority design; synthetic test maps не подходят.
4. TypeScript snapshot diagnostics и активные legacy authorization risks должны быть устранены до интеграции; затем новый DB backup/migration review и полные isolated tests.

**Deployment не выполнялся.** Текущие frontend `http://localhost:3004/`, backend `http://127.0.0.1:3006/` не перезапускались. Их новая runtime-работоспособность не тестировалась этим заданием. Существующие пользователи, бонусные остатки, PostgreSQL, Mailpit и Docker resources не изменялись.
