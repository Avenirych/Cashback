#!/bin/sh
set -eu
set -o pipefail
export LC_ALL=C TZ=UTC SOURCE_DATE_EPOCH=0
umask 022
exec > /out/checks.log 2>&1
test "$(uname -m)" = x86_64
test "$(gcc -dumpfullversion)" = 15.2.0
ld --version > /out/ld-version.txt
grep -Eq '^GNU ld .* 2[.]45[.]1$' /out/ld-version.txt
printf '#include <linux/version.h>\n#if LINUX_VERSION_CODE != KERNEL_VERSION(7,0,0)\n#error unexpected_headers\n#endif\n' |
    gcc -x c -E - >/dev/null
gcc --version
cat /out/ld-version.txt
# Bootstrap completed in a different CI container. Build/mocks are offline.
cmp /src/toolchain.lock /toolchain.lock
test -r /usr/lib/libc.a
flags='-std=c11 -O2 -Wall -Wextra -Werror -D_FILE_OFFSET_BITS=64 -fno-ident -fno-pie -no-pie -static'
for dir in /out/a /out/b; do
    mkdir "$dir"
    cp /src/r07-loop-identity.c /src/mock-harness.c "$dir/"
    (
      cd "$dir"
      gcc $flags -ffile-prefix-map="$dir"=. -frandom-seed=r07-loop-identity \
        -Wl,--build-id=none -o r07-loop-identity r07-loop-identity.c
      gcc $flags -ffile-prefix-map="$dir"=. -frandom-seed=r07-mock-harness \
        -Wl,--build-id=none -o mock-harness mock-harness.c
    )
done
/out/a/mock-harness
/out/b/mock-harness
cmp /out/a/r07-loop-identity /out/b/r07-loop-identity
cmp /out/a/mock-harness /out/b/mock-harness
mkdir /out/artifact
cp /out/a/r07-loop-identity /out/artifact/
cp /src/r07-loop-identity.c /src/mock-harness.c /src/build.sh /src/toolchain.lock /out/artifact/
cp /toolchain-installed.txt /toolchain-archives.sha256 /out/artifact/
readelf -hW /out/artifact/r07-loop-identity > /out/artifact/elf-header.txt
readelf -lW /out/artifact/r07-loop-identity > /out/artifact/elf-programs.txt
readelf -dW /out/artifact/r07-loop-identity > /out/artifact/elf-dynamic.txt
grep -Eq 'Class: +ELF64' /out/artifact/elf-header.txt
grep -Eq 'Data: +2.s complement, little endian' /out/artifact/elf-header.txt
grep -Eq 'Type: +EXEC ' /out/artifact/elf-header.txt
grep -Eq 'Machine: +Advanced Micro Devices X86-64' /out/artifact/elf-header.txt
if grep -Eq '(^|[[:space:]])INTERP([[:space:]]|$)' /out/artifact/elf-programs.txt; then exit 71; fi
if grep -q '(NEEDED)' /out/artifact/elf-dynamic.txt; then exit 72; fi
printf 'MOCK_TESTS=PASS\nREPRODUCIBLE_TWO_DIRECTORIES=PASS\nELF_STATIC_X86_64=PASS\nLIVE_STORAGE_TEST=NOT_RUN\nR07=NO_GO\n' > /out/artifact/verification.txt
(
 cd /out/artifact
 sha256sum r07-loop-identity.c mock-harness.c build.sh toolchain.lock > SOURCE_SHA256SUMS
 sha256sum r07-loop-identity > BINARY_SHA256SUMS
 sha256sum -c SOURCE_SHA256SUMS
 sha256sum -c BINARY_SHA256SUMS
)
printf 'BUILD_CHECKS=PASS\n'
