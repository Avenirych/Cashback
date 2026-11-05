#!/bin/sh
set -eu
umask 077
[ "$(id -u)" = 1000 ]
mkdir -p "$HOME/.pki/nssdb"
certutil -N -d "sql:$HOME/.pki/nssdb" --empty-password
certutil -A -d "sql:$HOME/.pki/nssdb" -n cashback-staging-only -t C,, -i /tls/ca.pem
# No browser debug TCP port. Operator invokes phases with docker exec.
exec sleep 900
