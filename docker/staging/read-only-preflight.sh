#!/bin/sh
# Read-only initial rehearsal preflight. NEVER starts/stops/builds containers or reads secret contents.
set -eu
refuse() { echo "STAGING_PREFLIGHT_REFUSED:$1" >&2; exit 1; }
[ "$(uname -s)" = Linux ] || refuse PLATFORM
[ "$(docker -H unix:///var/run/docker.sock info --format '{{.ID}}')" = 9c7d502b-f027-4b4d-bb41-0c57d5b10907 ] || refuse DAEMON
[ "$(docker -H unix:///var/run/docker.sock info --format '{{.DockerRootDir}}')" = /var/lib/docker ] || refuse DATA_ROOT
[ -z "$(docker -H unix:///var/run/docker.sock ps -aq)" ] || refuse NONEMPTY_ENGINE
[ "$(awk '/MemTotal:/ {print int($2/1024)}' /proc/meminfo)" -ge 2800 ] || refuse MEMORY_CAPACITY
[ "$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)" -ge 2304 ] || refuse MEMORY_AVAILABLE
[ "$(df -Pk /var/lib/docker | awk 'END {print $4}')" -ge 10485760 ] || refuse DISK_FREE
[ "${STAGING_SECRET_DIR-}" = /etc/cashback-staging/secrets ] || refuse SECRET_PATH
[ "$(readlink -f "$STAGING_SECRET_DIR")" = "$STAGING_SECRET_DIR" ] || refuse SECRET_SYMLINK
[ "$(stat -c '%u:%a' "$STAGING_SECRET_DIR")" = 0:700 ] || refuse SECRET_DIRECTORY_PERMISSIONS
[ "$(find "$STAGING_SECRET_DIR" -mindepth 1 -maxdepth 1 | wc -l)" -eq 14 ] || refuse UNEXPECTED_SECRET_ENTRIES
for spec in pg_owner_password:0 db_password:1000 jwt_secret:1000 smtp_password:1000 pg_key:0 mail_key:1000 mail_auth:1000 web_key:101; do
 name=${spec%:*}; uid=${spec#*:}; file="$STAGING_SECRET_DIR/$name"
 [ -f "$file" ] && [ ! -L "$file" ] && [ -s "$file" ] || refuse SECRET_FILE
 [ "$(stat -c '%u' "$file")" = "$uid" ] || refuse SECRET_OWNER
 case "$(stat -c '%a' "$file")" in 400|600) ;; *) refuse SECRET_MODE ;; esac
done
for name in pg_cert mail_cert staging_ca web_cert tester_ca tester_crl; do
 file="$STAGING_SECRET_DIR/$name"
 [ -f "$file" ] && [ ! -L "$file" ] && [ -s "$file" ] || refuse PUBLIC_CERT_FILE
 [ "$(stat -c '%u:%a' "$file")" = 0:444 ] || refuse PUBLIC_CERT_MODE
done
# ext4 named volumes do NOT get a hard quota merely from a Compose size option.
# Requires a separately approved quota/monitoring decision; never turn this into apply authority.
echo 'STAGING_PREFLIGHT_NOT_ADMISSION:VOLUME_QUOTA_UNRESOLVED' >&2
exit 2
