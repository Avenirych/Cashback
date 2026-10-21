# 6В.5.8-Г — межзаявочный инвариант перед реализацией

Вариант A утверждён владельцем; несколько candidates одной заявки, одно решение requestId/operationVersion, immutable reason-only история, linked request без наследования approval. Apply/supersession/coverage writers не реализуются.

Проект DB защиты, реализуемый в данном ограниченном этапе:

- UNIQUE exact approved `(originalPartId, baseVersion, operationVersion)` на существующей decision history: исключает два одновременно применимых approval разных candidates/requests для одной immutable исходной части и одной evidence версии. Разные metadata не обходят отсутствие supersession.
- UNIQUE exact decision `(originalPartId, baseVersion, operationVersion, intentFingerprint)` для approved/rejected: идентичное исправление нельзя повторно рассмотреть через другой requestId и превратить прежний rejected intent в approved этой версии.
- CandidateFingerprint включает все существенные candidate facts, request и доверенную identity; отдельный deterministic intentFingerprint исключает технические request/candidate/actor IDs, но включает protected origin/base/evidence и точную metadata. Это ключ межзаявочной эквивалентности, не proof банка.
- Immutable linkedFromRequestId в той же таблице requests; одинаковые part/context, verified participant во всей ancestry, no cycles. Independent review сравнивает reviewer participant со ВСЕМИ инициаторами цепочки, не только последним.
- Historical decision bindings NULL без backfill. Old reason-only status approved не exact-approved. Занятый request/evidence slot требует новой linked request, не изменения старого decision.
- После restore новая evidence version требует нового candidate текущей версии и fresh independent approval; прежние записи historical, не supersession.

Все guard/checks выполняются под существующим READ COMMITTED lock order authorization → scope → identity → operation → lot → receipt → requests → candidate → decisions. Candidate/review не принимает решения об отсутствии coverage и не использует деньги: coverage writers изменять не требуется.

При наличии будущих effective versions/base>0 fail closed до отдельного version resolver; сейчас base=0 относится только к immutable original part, проверяется его snapshot/hash. Нет fake head или application.

Lot-version protocol остаётся проектным контрактом 8D/8C, не реализацией: sidecar generation, все writers update в общей transaction, insertion guards и compatible locks, mixed RC/SS tests до apply. Требуют отдельного согласования: finite retry N/deadline/backoff, production auth epoch/proof-validity adapter и дополнительное разделение reviewer/executor сверх независимости от инициатора. Не устанавливаются тарифы, TTL, новые margin/split политики.

Реализация должна проверить DB uniqueness/immutability, cross-request races/rejection bypass, ancestry identity, replay/revoke/restore/rollback, прежние regression tests и неизменность monetary rows. Миграция только в identity-confirmed isolated finance database. FinanceModule/AppModule, реальные деньги, frontend/legacy и Git history не затрагиваются.
