#!/bin/sh
set -eu
refuse(){ echo "FUNCTIONAL_ACTIVE_ADMISSION_REFUSED:$1" >&2; exit 2; }
[ "$#" = 1 ] || refuse PIN_REQUIRED
cd /opt/cashback-staging
[ "$(sha256sum docker/staging/functional.sha256 | cut -d ' ' -f1)" = "$1" ] || refuse MANIFEST_PIN
sha256sum -c docker/staging/functional.sha256 >/dev/null || refuse SOURCE_PIN
[ "$(docker info --format '{{.ID}}')" = 9c7d502b-f027-4b4d-bb41-0c57d5b10907 ] || refuse DAEMON
[ "$(docker ps -aq | wc -l)" -eq 4 ] || refuse CONTAINER_SET
count=0
while read -r svc id expected; do
 case "$svc" in postgres|mail|backend|frontend) ;; *) refuse SERVICE;; esac
 [ "$(docker inspect --format '{{.Id}}' cashback-staging-b02-$svc-1)" = "$id" ] || refuse CONTAINER_ID
 [ "$(docker inspect --format '{{.State.Health.Status}}' "$id")" = healthy ] || refuse HEALTH
 actual=$(docker inspect --format '{{json .Config}} {{json .HostConfig}} {{json .Mounts}}' "$id" | sha256sum | cut -d ' ' -f1)
 [ "$actual" = "$expected" ] || refuse CONFIG_DRIFT
 count=$((count+1))
done < docker/staging/functional-active-policy.tsv
[ "$count" -eq 4 ] || refuse POLICY_COUNT
for net in application database mail; do [ "$(docker network inspect --format '{{.Internal}}' cashback-staging-b02_$net)" = true ] || refuse NETWORK; done
/usr/local/sbin/cashback-staging-storage-check
openssl verify -x509_strict -CAfile /etc/cashback-staging/secrets/staging_ca -verify_hostname cashback-staging.test /etc/cashback-staging/secrets/web_cert >/dev/null || refuse TLS
openssl verify -x509_strict -purpose sslclient -crl_check -CAfile /etc/cashback-staging/secrets/tester_ca -CRLfile /etc/cashback-staging/secrets/tester_crl /etc/cashback-staging/pki/client/synthetic-tester.crt >/dev/null || refuse MTLS
docker exec -i cashback-staging-b02-postgres-1 sh -c 'PGPASSWORD=$(cat /run/secrets/pg_owner_password); export PGPASSWORD; exec psql -X -w -U cashback_staging_owner -d cashback_staging_app -v ON_ERROR_STOP=1' < docker/staging/sql/70-functional-verify.sql >/dev/null || refuse DB_ROLE_DATA
printf 'FUNCTIONAL_ACTIVE_ADMISSION_PASS\n'
