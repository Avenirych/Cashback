# R06 security contract — prepared, NOT runtime admission

No containers, images, VM settings, certificates or credentials were created by this preparation. R07 NOT READY; external staging NO-GO.

## Closed TLS and tester gate

The proposed entry is guest-loopback HTTPS 127.0.0.1:33004. There is no VirtualBox forwarding and no Windows/public entry. Owner approval of the exact canonical HTTPS DNS origin and a separately reviewed access path is required before use. Do not expose HTTP or health ports.

Nginx requires a valid tester client certificate chained to tester_ca and a current tester_crl. Unknown TLS server names are refused; plaintext only redirects to the fixed approved origin. The unpublished loopback health listener serves a constant response only. mTLS grants network admission, never an application identity: JWT and all server authorization remain required. DEMO_ONLY remains true; public registration is not enabled. Tester enrollment is separately authorized and synthetic only.

Owner must designate certificate issuer, authorized testers, expiry/revocation and protected private-key storage. No actual CA, certificate, password or key has been generated. Never submit secrets in reports, Git, environment dumps or command arguments. Compose file secrets are bind-mounted files, not encrypted secret storage.

## Secret provisioning (future separate approval)

STAGING_SECRET_DIR must be /etc/cashback-staging/secrets in the guest, outside every build context. Fourteen files are required: pg_owner_password, db_password, jwt_secret, smtp_password, pg_cert, pg_key, mail_cert, mail_key, mail_auth, staging_ca, web_cert, web_key, tester_ca, tester_crl. read-only-preflight.sh specifies expected numeric ownership and modes; verify actual pinned-image users before provisioning. No symlinks. Private material must never enter the repository. PostgreSQL and SMTP TLS require matching SANs postgres/mail; frontend certificate must match the approved DNS origin. TLS certificate validity, CRL freshness and client rejection must be proved in R07. Review CA scope and separate server/client issuance.

Nginx request/error logging is disabled; PostgreSQL statement and parameter logging is suppressed. This limits diagnostics. Application error redaction and Mailpit behavior still require runtime inspection with synthetic inputs; no claim of universal log redaction is made.

## Pins and build context

image-pins.json records exact version/digest references and linux/amd64 metadata verified previously on October 30. This is not fresh registry verification, signature approval or vulnerability clearance. Dockerfile syntax and base images are pinned; no environment image override is accepted. Dockerfile-specific context allowlists exclude common secret/artifact names; tests simulate known paths and are not proof against arbitrary secret filenames. Review the actual build context before any authorized build. Do not build in the current 2 GiB VM.

## Resource limits and unresolved disk protection

PostgreSQL: 512 MiB, .25 CPU, 128 pids; backend: 640 MiB, .4 CPU, 128 pids; mail/frontend each128 MiB, .1 CPU, 64 pids. Swap limits equal memory limits. Tmpfs and logs are bounded; backend Node heap384 MiB. Total container memory caps1408 MiB exclude VM/engine overhead and reserve. Current2 GiB VM does not meet the proposed minimum2800 MiB total/2304 MiB available. A roughly3 GiB VM requires separate approval and host capacity recheck; no VM changes were made.

Named PostgreSQL/avatar volumes on ext4 have NO enforced hard quota. Proposed budgets3 GiB/.25 GiB are monitoring targets, not enforcement. PostgreSQL max_wal_size is not a database-size quota. read-only-preflight.sh intentionally exits2 with VOLUME_QUOTA_UNRESOLVED even after all other checks. Owner must approve a separately designed hard-quota/storage solution or a reviewed bounded monitoring/stop strategy before R07 admission. No disk partition, VDI or VM changes are authorized here.

## Available checks and mandatory next steps

node docker/staging/validate.cjs --static and node --test docker/staging/config.test.cjs docker/staging/security.test.cjs are offline configuration checks. The non-static validator also requires approved origin, fixed external secret directory and independently attested synthetic cluster identifier. They do not authorize launch. Guest read-only preflight must target only its pinned Unix daemon, empty inventory and D-backed data-root.

Before R07: approve origin/access/CA ownership; provision protected secrets separately; resolve RAM and disk admission; review current image vulnerabilities/provenance; validate actual nginx configuration and envsubst availability; run TLS/mTLS/expired/revoked/no-cert tests; confirm health cannot reach application; inspect CSP/browser behavior, SMTP recipient and relay denial, PG identity/TLS/runtime grants, B01 fail-closed and all B04 denies against synthetic data only. Confirm limits, cgroups, log bounds, volume growth and host RAM under actual load. SQL baseline is prepared, never automatically applied. No financial migrations, enrollment, API module or financial operations are enabled.

No localhost public origins, real accounts, historic database attachments, real email or production credentials are permitted. Stop on identity drift, unexpected ports/resources, memory pressure or any financial admission opening. A future R07 launch needs separate owner authorization.
