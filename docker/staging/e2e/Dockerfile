FROM mcr.microsoft.com/playwright@sha256:ee15712262f017b8157421b212b12099146645f44b1bc5c0514cbbe6a229b1d0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends libnss3-tools strace && rm -rf /var/lib/apt/lists/*
WORKDIR /e2e
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --ignore-scripts --no-audit --no-fund --save-exact playwright@1.64.1
USER pwuser
ENV HOME=/tmp/home NODE_EXTRA_CA_CERTS=/tls/ca.pem
CMD ["node"]