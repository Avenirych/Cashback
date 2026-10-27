# Historical registration support — not application source

These 24 original TypeScript modules are recovered byte-for-byte from the verified source snapshot `cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15/project` (19 October 2026). Every file matches that snapshot's independent `verification.json`; `PROVENANCE.json` records exact paths, sizes and SHA256 hashes.

The three infrastructure modules were never present in the available Git history even though their consumers were included in canonical baseline a27fa64889bed8c9ed0d98903ab3ab8fe0f8c54f. The historical Mailpit implementation was separately deferred in the remote-source archive. Its snapshot variant is the original 3003 policy required by these historical tests, not the different archived 3000 policy.

This directory is outside application `src`, the backend build roots and active migration discovery. The historical phone migration definitions are dependencies of the recovered harness, NOT migrations to install or register in the application. No current auth/mail/entity/AppModule/datasource wiring is changed. No migration, infrastructure authority or financial function is activated.

Existing historical scripts and tests now use this isolated source location. Helper Dockerfiles and their compiler configuration refer to the same location; no image was built or started. All original signed-approval, target identity, external fencing, credential and concurrency gates are retained. Expected identities are historical assertions, never live evidence or permission to operate on existing resources.

Do not deploy, invoke protected helper operations, provision credentials, build images or run migrations without a separate owner-approved procedure. Bare historical entrypoints remain blocked/offline. Run unit tests only with the repository's offline process/network/database guard and temporary data on D:.

A narrowly scoped Git attribute disables newline conversion only for these recovered source files, preserving the recorded SHA256 across Windows and Linux checkouts. It does not exclude files from diff or relax whitespace/test checks.

The same scoped attribute recognizes original CRLF as an end-of-line sequence while retaining blank-at-eol, blank-at-eof and space-before-tab checks. No test assertions or ordinary trailing-space checks are disabled.
