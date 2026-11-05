# syntax=docker/dockerfile:1.27.1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c
ARG NGINX_IMAGE=nginx:1.28.3-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY cashback-frontend/package.json cashback-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY cashback-frontend/public ./public
COPY cashback-frontend/src ./src
COPY cashback-frontend/scripts ./scripts
COPY cashback-frontend/tsconfig.json ./
ARG STAGING_WORKFLOWS=disabled
RUN test "$STAGING_WORKFLOWS" = disabled || test "$STAGING_WORKFLOWS" = synthetic-v1
ENV REACT_APP_STAGING_WORKFLOWS=${STAGING_WORKFLOWS}
ENV REACT_APP_STAGING=true REACT_APP_API_BASE=/api REACT_APP_DEMO_ONLY=true REACT_APP_ACTIVITY_LIMITS=true REACT_APP_REGISTRATION_ISOLATED=true REACT_APP_BONUS_READ_ONLY=false REACT_APP_LOCAL_DEMO_REVIEWS=false REACT_APP_REVIEWS_MODE=public GENERATE_SOURCEMAP=false
# Shared config targets root TS6; isolated frontend lockfile uses TS4.9 (no such deprecation option).
RUN node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('tsconfig.json'));delete c.compilerOptions.ignoreDeprecations;fs.writeFileSync('tsconfig.json',JSON.stringify(c));"
RUN ./node_modules/.bin/tsc --noEmit --incremental false
RUN npm run build
COPY docker/staging/check-bundle.cjs /check-bundle.cjs
RUN node /check-bundle.cjs /app/build
FROM ${NGINX_IMAGE} AS runtime
COPY --from=build /app/build /usr/share/nginx/html
COPY docker/staging/nginx.conf /etc/nginx/staging.conf.template
COPY docker/staging/security-headers.conf /etc/nginx/staging-security-headers.conf
COPY docker/staging/frontend-entry.sh /staging-entry.sh
COPY docker/staging/robots.txt /usr/share/nginx/html/robots.txt
USER 101:101
ENTRYPOINT ["sh", "/staging-entry.sh"]
CMD []
