# Historical cutover complete

Canonical baseline: 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7

Open http://localhost:3004/ . Backend http://127.0.0.1:3006 ; Mailpit http://127.0.0.1:8036 .

Database already initialized: NEVER rerun schema.sql or recreate PostgreSQL. See CUTOVER-RESULT.json for exact identities and evidence. Only old frontend/backend were stopped; all old data resources remain. No live registration was performed.

Rollback archive: C:/Users/serge/AppData/Local/Temp/cashback-final-cutover-c21f3bb8a7b04bc6bceee8ff308aaa77 . Encrypted JWT at archive/jwt.dpapi; encrypted database credentials remain in C:/Users/serge/AppData/Local/Temp/cashback-historical-db-dfaf9c2731cf442bb448a80c6e324511 . Do not publish credential files. Existing containers retain configuration; do not generate replacement secrets silently.

Cleanup is plan-only; see CLEANUP-MANIFEST.json.
