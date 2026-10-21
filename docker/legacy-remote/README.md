# Deferred remote material — not activated

Approved remote parent: `d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f`.

`activation-manifest.json` lists every non-database remote-only addition, its original Git blob and exact SHA-256 archive. `.source.txt` files are provenance references, outside application source roots and migration discovery. They are not executable migration inputs. Original paths and full history remain recoverable from the remote merge parent. The local per-file raw backup additionally preserves the initial working files.

The remote owner-phone PATCH, phone verification columns, SMS revocation workflow, readiness/demo wiring and associated migrations are DEFERRED. In particular `1792195200000-AddUserPhoneAndSmsConsent` must not execute. No remote CLI data source is retained under executable source paths. The application migration list remains empty; synchronization and automatic migrations stay disabled. The 16 canonical isolated financial migrations remain unchanged and FinanceModule stays disconnected.

Compatible remote auth/mail/JWT tests are adapted to current registration details, safe own-account phone fields, atomic token consumption, existing HTTP error contracts and persisted-user principals. Original reference tests for deferred phone/schema/demo contracts remain archived, not represented as executed tests. No current canonical test is removed or skipped. Current frontend phone validation intentionally rejects a number that does not match the selected country.

The retained `cashback-frontend/bonus-api` is CI-only. It exports the historical BonusService for in-memory tests, refuses persistent database paths, and refuses direct server/CLI activation. Its old HTTP boot code is an uncalled reference, not exported. No Docker service or website route points to it. SQLite database/WAL/SHM payloads are excluded from the candidate index; existing local payloads are not inspected, imported or deleted. Test with `npm ci --no-audit --no-fund` and `npm test` in a clean copy of that directory without `data/`.

This reference archive does not authorize migrations, deployment, database access, or cleanup.

The archive-only Git attributes preserve exact original bytes across Windows checkouts and retain original blank lines at EOF. Application-source whitespace checks are unchanged. The dormant demo launcher test is adapted to assert the canonical Nest `npm start`; it does not reactivate the old frontend launcher or change any launcher behavior.
