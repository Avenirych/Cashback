# syntax=docker/dockerfile:1.27.1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
ARG POSTGRES_IMAGE=postgres:17.11-bookworm@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5
FROM ${POSTGRES_IMAGE}
COPY docker/staging/postgres-entry.sh /staging-entry.sh
COPY docker/staging/pg_hba.conf /etc/postgresql/staging_hba.conf
ENTRYPOINT ["sh", "/staging-entry.sh"]
CMD ["postgres"]
