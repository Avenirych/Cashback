# Prepared financial reader and cutover

Not imported into AppModule. No live endpoints, migrations, grants or writers enabled.

Order: existing 17 migrations, AddFinanceIdentity1793201000000, AddFinanceCutover1793202000000. Use a separately reviewed maintenance transaction with a trusted NOLOGIN owner. Identity migration intentionally refuses LOGIN/superuser owners. It needs temporary approved DDL authority over users; do not grant it to the legacy runtime. Registry creation never changes legacy balances or declares money received.

UUID registry is forward-only after enrollment. Deleting a user preserves issued identities. Inserts ignore caller UUID. Existing User entity deliberately remains unchanged, so an unapplied finance migration cannot break active legacy ORM queries. Financial lookup uses explicit columns only.

Prepare a dedicated DataSource named finance-readonly, username cashback_finance_ro, synchronize=false, migrationsRun=false. Review finance-reader-grants.sql against the exact database. Verify PUBLIC/default ACL, schema/database CREATE/TEMP, memberships, object ownership and function EXECUTE before connection. The role must never inherit write rights. History grants cover only the columns used by the prepared own-lot-account history endpoint.

Prepared GET endpoints: /api/v1/my/bonus-data and /api/v1/my/bonus-data/history. No mutation endpoints. History returns at most 100 recent own lot-account postings, hasMore and complete=false; it is not a full account statement or payout quote. Bank references, request hashes, event keys and counterparties are not returned. No legacy balance fallback.

JWT uses the current secret and signature/expiry checks plus a mandatory signed account_uuid. Numeric sub alone cannot safely identify an account generation. financeSessionClaims prepares claims only after a fresh verified server identity lookup. Existing token issuance is NOT changed: a separately approved issuer update and reauthentication are prerequisites to public connection. Old JWTs cannot access this reader. User and UUID are reread in a read-only repeatable-read transaction; ledger predicates use only the server-derived owner.

Cutover is planned for 2026-11-01T00:00:00Z. admission_enabled=false is constrained and immutable. A new separately approved release is required to enable any writers; date alone cannot enable them. Closed admission guard executes before the old terms trigger. Missing dates stay NULL, late pre-cutover events stay historical, existing expiry/obligations remain unchanged. Historical review manifest is append-only and not readable by the public reader. No historical import is performed.

Repeatable isolated SQL test: provide CASHBACK_FINANCE_TEST_DIR pointing to a dedicated D:/Cashback+ archive/reports directory containing that test cluster's pg-connect.json and pg-data. The runner verifies PG17, data directory and fixed synthetic database name before resetting ONLY that synthetic database. Never supply live credentials. It applies all 19 migrations, checks identity/grants/cutover/rollback; it does not connect to Docker. Test role and data are disposable inside that cluster.

Financial launch remains blocked on historical review decisions, separately approved working migrations/grants, secure token issuance, complete statement pagination if required, writer admission release, reconciliation and production deployment approval. Read-only API preparation is not financial activation.
