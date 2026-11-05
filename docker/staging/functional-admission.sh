#!/bin/sh
# Upgrade admission: intentionally distinct from empty-engine initial admission.
# Does NOT execute SQL or change Docker. Caller supplies reviewed manifest SHA pin.
set -eu
refuse(){ echo "FUNCTIONAL_ADMISSION_REFUSED:$1" >&2; exit 2; }
[ "$#" = 1 ] || refuse MANIFEST_PIN_REQUIRED
cd /opt/cashback-staging
[ "$(sha256sum docker/staging/functional.sha256 | cut -d ' ' -f1)" = "$1" ] || refuse MANIFEST_PIN
sha256sum -c docker/staging/functional.sha256 >/dev/null || refuse SOURCE_PIN
[ "$(docker -H unix:///var/run/docker.sock info --format '{{.ID}}')" = 9c7d502b-f027-4b4d-bb41-0c57d5b10907 ] || refuse DAEMON
[ "$(docker ps -aq | wc -l)" -eq 4 ] || refuse CONTAINER_SET
for pair in postgres:865ef6ec52adffcc702a069be7bebfd1d3d964f62adf6ba4d57ca2a54f9b2bdb mail:427f69f1d822fcf5d0505433300824d8b5d9747db6ffd6adf3ee0138fef46ba5 backend:7d3f343c708fad9771ba67f3f32170d8e38d47437b0794d9e831c66b78b04cbe frontend:5b656f0c329fc3abc9be6a7ff2c8445932c96f1a9f91920416550b2e1fceba33; do
 svc=${pair%%:*}; id=${pair#*:}
 [ "$(docker inspect --format '{{.Id}}' cashback-staging-b02-$svc-1)" = "$id" ] || refuse CONTAINER_ID
 [ "$(docker inspect --format '{{.State.Health.Status}}' "$id")" = healthy ] || refuse HEALTH
 [ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" = cashback-staging-b02 ] || refuse PROJECT
 bindings=$(docker inspect --format '{{json .NetworkSettings.Ports}}' "$id")
 case "$bindings" in *HostPort*) refuse PORTS;; esac
 [ "$(docker inspect --format '{{.HostConfig.Privileged}}' "$id")" = false ] || refuse PRIVILEGED
 [ "$(docker inspect --format '{{json .Config}} {{json .HostConfig}} {{json .Mounts}}' "$id" | sha256sum | cut -d ' ' -f1)" = "$(cat /etc/cashback-staging/functional-$svc.config.sha256)" ] || refuse CONFIG_DRIFT
 done
for net in application database mail; do [ "$(docker network inspect --format '{{.Internal}}' cashback-staging-b02_$net)" = true ] || refuse PRIVATE_NETWORK; done
/usr/local/sbin/cashback-staging-storage-check
for name in pg_owner_password db_password jwt_secret smtp_password pg_cert pg_key mail_cert mail_key mail_auth staging_ca web_cert web_key tester_ca tester_crl; do [ -s /etc/cashback-staging/secrets/$name ] || refuse SECRET_MISSING; done
openssl verify -x509_strict -CAfile /etc/cashback-staging/secrets/staging_ca -verify_hostname cashback-staging.test /etc/cashback-staging/secrets/web_cert >/dev/null || refuse SERVER_TLS
openssl verify -x509_strict -purpose sslclient -crl_check -CAfile /etc/cashback-staging/secrets/tester_ca -CRLfile /etc/cashback-staging/secrets/tester_crl /etc/cashback-staging/pki/client/synthetic-tester.crt >/dev/null || refuse TESTER_TLS
# Authoritative runtime schema/role/target checks are also performed before Nest initialization.
echo FUNCTIONAL_PREPARED_ADMISSION_PASS_NOT_APPLY_AUTHORITY
