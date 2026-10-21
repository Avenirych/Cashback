FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
COPY cashback-frontend/package.json cashback-frontend/package-lock.json ./
RUN npm ci
COPY cashback-frontend/public ./public
COPY cashback-frontend/src ./src
COPY cashback-frontend/tsconfig.json ./tsconfig.json
COPY cashback-frontend/scripts ./scripts
RUN npm run build
EXPOSE 3000
CMD ["node", "node_modules/react-scripts/scripts/start.js"]
