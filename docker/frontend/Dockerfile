# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
WORKDIR /app
COPY cashback-frontend/package.json cashback-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY cashback-frontend/tsconfig.json ./
COPY cashback-frontend/public ./public
COPY cashback-frontend/src ./src
COPY cashback-frontend/scripts ./scripts
RUN chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 BROWSER=none
EXPOSE 3000
CMD ["npm", "start"]
