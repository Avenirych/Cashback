# Header site search

Restored from `d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f`: SiteSearch UI/CSS and public index generator. The old Search.tsx product-search page was not restored because it calls an unrelated backend; `/search` reuses SiteSearch in results mode.

## Changed files

- cashback-frontend/src/components/Header.tsx
- cashback-frontend/src/components/SiteSearch.tsx
- cashback-frontend/src/components/SiteSearch.css
- cashback-frontend/src/components/SiteSearch.test.tsx
- cashback-frontend/src/App.tsx
- cashback-frontend/scripts/build-search-index.mjs
- cashback-frontend/public/search-index.json
- cashback-frontend/package.json
- docker/historical/frontend.Dockerfile
- docker/historical/run-offline.cjs
- docker/historical/SEARCH-RESULT.json

## Validation

80 tests / 7 suites passed. Frontend TypeScript, generator syntax, production Docker build and git diff --check passed. Existing Register/emailValidator lint warnings remain. Index contains 15 static public routes, with page text and scoped translations, including inline JSX translation dictionaries. No private profiles, auth pages, API records or runtime forum posts are indexed. Build and start scripts regenerate the index.

Runtime evidence and exact frontend identity are recorded in SEARCH-RESULT.json. No visual browser automation was performed. Responsive CSS restores wrapping and a full-width mobile search row; final visual verification remains manual.

## Manual check

1. Open http://localhost:3004/ and select Russian or English.
2. Enter `кешбэк` or `retention` in the Header; submit using Enter and the button.
3. Check titles/excerpts and follow a result to FAQ or Privacy Policy.
4. Refresh http://localhost:3004/search?q=retention.
5. Try an unmatched query and an empty query; repeat with a narrow/mobile viewport.
