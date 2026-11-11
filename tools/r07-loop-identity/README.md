# R07 loop identity: reviewed CI proposal, not applied or executed

R07 NO-GO. No staging input, secrets, storage data or deployment step is included.

## Selected environment B
Docker Official Image alpine:3.24.4 linux/amd64 is pinned to manifest
sha256:0f49f331d9212aff11b932863be4eb01cdf962969aa86dab7d1ee21ac6f5f52b.
The matching config ID is checked before bootstrap.
The official v3.24/main/x86_64 signed APKINDEX is pinned to SHA256
820b86abfe4283351dd1b768845eb910db39e8b7e0b6d3e0c413c496d5dbd95b.
Seventeen explicit package versions are in toolchain.lock. isl26 is selected
explicitly because the index contains two providers of libisl.so.23.
GCC 15.2.0-r5, musl/musl-dev 1.2.6-r3, binutils 2.45.1-r1 and
linux-headers 7.0.0-r1 are checked/recorded. All 17 APK URLs returned HTTP 200
to HEAD at review time; their binary bodies have NOT been downloaded locally.
Bootstrap occurs only on a disposable hosted CI runner: download the locked
index and explicit APK files, then invoke APK with --no-network and only a local
repository. APK's normal signature/digest verification remains enabled using
trusted keys from the pinned official base. No --allow-untrusted/key replacement.
Changing the index aborts the run; do not silently update the lock.
Package archive SHA256 values and installed metadata are recorded in the image.
The derived toolchain image is not published; its exact local ID is used to run
the compiler and recorded in the artifact. This ID is not known before CI.
Actual archive signatures and successful solver/bootstrap remain unverified
until CI; failures stop before compilation/upload.

## Rejected alternative A
Community muslcc/x86_64 image digest
sha256:173c042a23a544defa3364d4472b30b36af1d827a74cd8dab7683b8500004334
is immutable but has unverified provenance. Its registry metadata dates to 2021.
Published ingredient versions GCC 11.2.1, binutils 2.37, headers 5.15.2 and musl
b76f37f are not proof of those components inside that image. It is not selected.

## Network and permissions boundary
Image pull/APK bootstrap and Actions artifact upload use network.
Compilation, both mock runs and ELF checks run in a separate docker run with
--network none, non-root UID, read-only rootfs/source, capabilities dropped,
no-new-privileges, and resource limits.
Only this source directory and a fresh output directory are mounted.
No host Docker socket, .git directory, runner environment, credentials, SSH keys,
VM files or storage devices are passed to the build/test container.
Only contents:read is granted to Actions; checkout does not persist credentials.
No environment or deployment secrets are requested. Artifact paths are explicit
and host-side regular-file/symlink checks precede upload.

## First launch WITHOUT modifying main
After separate explicit approval, create branch r07/loop-identity-build from a
reviewed base commit; apply only this patch and review the six added files.
Commit and push only that branch to Avenirych/Cashback. The push itself is the
authorized CI launch, so do not push until execution is approved.
Workflow push filters match only this branch and these source/workflow paths.
The job checks repository, event and exact branch again.
Do not create a PR or edit main just to register workflow_dispatch.
Existing CI has pull_request and push/main triggers and remains unchanged.
No branch, commit, push, PR, workflow registration, image pull or Actions run
has been performed during preparation/review.

## Static review corrections
- BAD_OPTIONS is now included, with named expected rejection reasons.
- Negative fixtures require the expected failure reason; faults require an
  observed rejection, no write/unknown ioctl flags and no mock FD leaks.
- All fault classes must be exercised by the positive baseline.
- A wide device/inode fixture checks encoding and 64-bit inode handling.
- Build script enables pipefail and all success markers follow tests/ELF/cmp.
- Mount record must have the expected outer mount as its parent.
- Source opens every path component with openat/O_NOFOLLOW; image is O_PATH.
- ABI assertions, bounded mountinfo parsing, two snapshots and metadata checks
  remain. UUID checking is still the responsibility of storage checker.

## Acceptance and limits
1. Patch apply --check, YAML parsing and shell syntax pass; no compilation is
   claimed from those static checks.
2. CI bootstrap verifies signed official packages and exact pins.
3. Compile helper/harness with -Werror; all mocks and nth-call faults pass.
4. The live helper is NEVER executed by CI. Mocks use fmemopen and fake FDs.
5. Two separate build directories produce byte-identical helper AND harness.
6. ELF64 little-endian AMD x86-64 EXEC, no PT_INTERP, no DT_NEEDED.
7. Source/binary SHA256 manifests verify; artifact retains three days only.
8. Review artifact plus CI commit/toolchain provenance before staging placement.
9. No test result admits R07. Live ioctl/kernel behavior still needs separate
   read-only validation; Guard/checker are unchanged by this patch.

Pinned official base, pinned index and explicit versions fix build inputs.
Repository archive retention, external download service and signature validation
can still cause a future run to fail; no fallback is allowed.
Derived OCI image metadata and hosted runner/kernel are not byte-reproducible
claims. Reproducibility tested here is helper/harness output within one run.
The SHA256 lock protects bytes; official distribution keys/publisher remain a
trust assumption. New headers are build-time UAPI; actual staging kernel
compatibility is not established by mocks.
Repeated snapshots do not eliminate TOCTOU/ABA or privileged reconfiguration.
Same-inode content changes are not detected. No production-readiness claim.
