#!/bin/sh
set -eu
# Official entrypoint needs root only to initialize/chown its isolated volume, then drops to postgres.
mkdir -p /run/staging-tls
cp /run/secrets/pg_cert /run/staging-tls/server.crt
cp /run/secrets/pg_key /run/staging-tls/server.key
chown postgres:postgres /run/staging-tls /run/staging-tls/server.*
chmod 700 /run/staging-tls
chmod 600 /run/staging-tls/server.key
exec /usr/local/bin/docker-entrypoint.sh "$@" -c ssl=on -c ssl_cert_file=/run/staging-tls/server.crt -c ssl_key_file=/run/staging-tls/server.key -c ssl_min_protocol_version=TLSv1.2 -c hba_file=/etc/postgresql/staging_hba.conf -c password_encryption=scram-sha-256
