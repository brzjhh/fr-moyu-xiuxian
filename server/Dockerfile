FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile --filter @chentu/server...

COPY server server
RUN pnpm --filter @chentu/server build

WORKDIR /app/server
EXPOSE 3000

CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
