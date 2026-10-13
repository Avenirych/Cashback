# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
WORKDIR /app
COPY cashback-frontend/bonus-api/package.json cashback-frontend/bonus-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && mkdir -p /data \
    && chown node:node /data
COPY cashback-frontend/bonus-api/server.mjs ./
USER node
ENV HOST=0.0.0.0 PORT=3002 BONUS_DATABASE=/data/bonuses.sqlite
EXPOSE 3002
CMD ["npm", "start"]
