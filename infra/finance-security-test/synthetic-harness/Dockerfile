FROM --platform=linux/amd64 python:3.13-slim-bookworm@sha256:a1165e272e578941b84abc79e4ab38a0305cd12803a5c4247979ac7655f4d641
WORKDIR /harness
COPY requirements.lock ./
COPY wheelhouse/psycopg-3.2.10-py3-none-any.whl /wheelhouse/
COPY wheelhouse/psycopg_binary-3.2.10-cp313-cp313-manylinux2014_x86_64.manylinux_2_17_x86_64.whl /wheelhouse/
RUN --network=none python -c "import sys,platform; assert sys.version_info[:2]==(3,13) and sys.platform=='linux' and platform.machine()=='x86_64'" \
    && python -m pip --disable-pip-version-check install --no-cache-dir --no-index --find-links=/wheelhouse --require-hashes --only-binary=:all: -r requirements.lock
COPY common.py provision.py ./
COPY sql/00_roles.sql sql/10_boundary.sql ./sql/
COPY synthetic-harness/ ./synthetic-harness/
USER 65534:65534
HEALTHCHECK NONE
ENTRYPOINT ["python", "-B", "/harness/synthetic-harness/worker.py"]
CMD []
