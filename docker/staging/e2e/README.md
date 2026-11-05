# Isolated Chromium E2E client — Linux/amd64

This optional Compose project never recreates any of the four staging services.
Use only after the existing functional-active admission passes with its independently
recorded manifest pin. The exact locally built browser image is required; pull is disabled.
No production deployment permission is implied.

## Sandbox scope

`seccomp-baseline.json` is the resolved OCI policy captured from Docker 29.9.2 on
Alpine Linux 6.18.59, with ALL capabilities dropped. `seccomp-chromium.json` preserves
that policy and adds only observed Chromium requirements:

* unshare flags exactly 0x10000000: nested user namespace.
* clone flags exactly 0x10000011: user namespace plus SIGCHLD.
* clone flags exactly 0x70000011: user/PID/network namespace plus SIGCHLD.
* clone flags exactly 0x20000011: renderer PID namespace plus SIGCHLD.
* chroot: Chromium's namespace sandbox chroots into `/proc/self/fdinfo/`.
  Seccomp cannot compare path strings; this allowance is syscall-wide. It does not
  grant CAP_SYS_CHROOT in the outer namespace. A direct nonroot chroot still fails.

These additions were established incrementally in network-none, secret-free probes.
No setns, mount, general namespace masks, clone3 allowance or capabilities were added.
clone3 remains ENOSYS, enabling legacy clone argument filtering. Kernel userns works
for nonroot outside Docker; the original refusal was the effective Docker seccomp.
The profile is tied to this tested x86_64 Docker/kernel/browser combination; a version
change requires renewed admission and secret-free probes, not broader fallback rules.

## Required admission and runtime checks

Run `node docker/staging/e2e/validate.cjs` and the E2E negative configuration tests.
Run existing B04 and staging configuration tests before an application-connected client.
Confirm functional-active admission, all four pinned service IDs/images/restart counts,
and internal application network. The original admission expects exactly four containers:
run it before creating and after removing the temporary fifth container; never weaken it.

Provide E2E_GATEWAY_IP from actual frontend network inspection. E2E_CLIENT_DIR must
be a protected tmpfs directory containing only staging public CA, synthetic tester leaf
and synthetic tester private key (`ca.pem`, `client.pem`, `client.key`), readable by UID1000.
Never provide a CA private key, database/mail credentials or the Docker socket.
E2E_OUTPUT_DIR must be bounded tmpfs owned by UID1000; export sanitized screenshots to D:.

Use `docker compose -f docker/compose.staging.e2e.yaml --profile e2e config` first.
Start ONLY the browser project with --no-build --pull never. Confirm actual nonroot,
read-only root, zero capabilities, NNP, exact seccomp, 768MiB memory/no swap, CPU0.5,
pids192, private shm128MiB, tmp256MiB, application network only and no port bindings.
Inspect mounted source paths before start. No host network/IPC, devices or public ports.

The entrypoint creates an isolated user NSS database. NODE_EXTRA_CA_CERTS scopes Node
TLS trust to the same staging CA. Run `/tests/tls.cjs` before `/tests/browser.cjs` phases.
Positive TLS requires server authorization and HTTP200; missing client cert must be
rejected (nginx HTTP400 is an expected certificate-gate refusal), absent trust must fail.
Never ignore certificate errors. Browser uses chromiumSandbox:true and channel chromium.

Browser phases: initial (DOM/languages/signup), email (operator captures only synthetic
fixture address), verify (Mailpit message via stdin, never logs token), flows (fresh login,
logout and protected routes). Fixture secrets live solely in container tmpfs. Mailpit
retrieval stays with the guest operator through its existing container-loopback API;
browser never joins database/mail networks. The client aborts requests outside staging origin.

Stop/remove ONLY the recorded temporary browser ID after tests. Erase its tmpfs leaf-key
copy and transient state. Do not prune/delete unrelated images, networks or volumes.
Recheck original admission, four healthy services, IDs/restarts and Windows3004/3006/PG.
A successful sandbox probe is not a successful application E2E result.

Observed full Chromium exhausted128 task slots during auth navigation. The temporary client
therefore uses192 task slots (no capability/syscall expansion), same768MiB memory/CPU0.5,
and init for orphan reaping. This change does not affect the four application services.
