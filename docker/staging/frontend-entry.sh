#!/bin/sh
set -eu
refuse() { echo 'STAGING_FRONTEND_CONFIGURATION_REFUSED' >&2; exit 1; }
umask 077
origin=${STAGING_FRONTEND_ORIGIN-}
case "$origin" in https://*) ;; *) refuse ;; esac
authority=${origin#https://}
# Only canonical lowercase DNS origin; no IP, credentials, path, query or shell metacharacters.
printf '%s' "$authority" | grep -Eq '^([a-z0-9]([a-z0-9-]*[a-z0-9])?[.])+[a-z0-9]([a-z0-9-]*[a-z0-9])?(:[1-9][0-9]{0,4})?$' || refuse
host=${authority%%:*}
case "$host" in localhost|*.localhost|*.local|*.internal) refuse ;; esac
case "$host" in *[!0-9.]*) ;; *) refuse ;; esac
case "$authority" in *:*) port=${authority##*:}; [ "$port" -le 65535 ] && [ "$port" != 443 ] || refuse ;; esac
for name in web_cert web_key tester_ca tester_crl; do
 [ -f "/run/secrets/$name" ] && [ -r "/run/secrets/$name" ] && [ -s "/run/secrets/$name" ] || refuse
done
export STAGING_FRONTEND_HOST="$host"
# Whitelist substitutions: nginx variables such as $host/$request_uri stay untouched.
envsubst '${STAGING_FRONTEND_ORIGIN} ${STAGING_FRONTEND_HOST}' < /etc/nginx/staging.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
