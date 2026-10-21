# Historical advertising demo restoration

The owner explicitly selected restoration of the historical demo animation, rather than adding real video or server credit accounting.

## Confirmed cause

BonusAds requested `/ads/coin.png`, while the recovered asset is `public/ads/Coin.png`. Linux serving is case-sensitive. The incorrect URL returned the SPA HTML fallback (HTTP 200, text/html), so Image failed to decode it. The original background was available as image/png. This was not a missing asset or backend failure.

## Historical model

Current source and d14f76e9 contain a five-second CSS animation, not a video player or advertisement API. Completion adds the selected 1, 2 or 3 to a per-user localStorage daily counter. It never charges bonuses. The Russian label was ambiguous; it now states the full-view reward. This non-authoritative browser demo counter is separate from server-side forum exchange credits. No server bonus operations were added. No MP4/WebM source was found in the inspected tracked historical files; video playback, codecs and video byte ranges are therefore not applicable to this restored mode.

Authentication, verified email and existing onboarding remain required. Hidden tabs pause the animation/timer. Interrupted views earn nothing. Completion is guarded against repeat callbacks; refresh preserves the daily demo counter but does not repeat the completed reward. This is not a secure financial ledger or a cross-browser/server balance.

## Changed files

- cashback-frontend/src/pages/BonusAds.tsx: exact asset case, PUBLIC_URL prefix, clear reward and demo/error copy.
- cashback-frontend/src/pages/BonusAds.test.tsx: eight mock regression cases.
- cashback-frontend/public/search-index.json: automatically regenerated public text.
- docker/historical/run-offline.cjs: includes the new safe suite.
- docker/historical/ADS-RESULT.json: active runtime evidence.

## Validation

88 tests in 8 frontend suites passed. Frontend TypeScript, Node syntax, production Docker build and git diff --check passed. Existing unrelated registration/email-validator lint warnings remain. Mock tests cover image readiness/failure, three-point reward only after completion, duplicate callbacks, refresh, abort, hidden-tab pause, anonymous/unverified access and onboarding. No accounts, balances or database records were changed.

Active served PNG bytes, MIME, dimensions, JS and route are checked by deployment, along with unchanged identities/images/start times of all other containers. See ADS-RESULT.json. Browser visual animation was not automated.

## Manual use

Open http://localhost:3004/bonuses/ads while signed in with a verified account and completed existing onboarding. Click the consent button and allow the five-second demo to finish. The local session/day counter increases by the displayed reward. Leaving the tab pauses viewing; ending early does not earn a reward. No real money or forum transfer credit is created.
