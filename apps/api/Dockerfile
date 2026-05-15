FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/core/ ./packages/core/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @meet-vista/core build || true
RUN pnpm --filter @meet-vista/api build

# Run db migrations at startup, then serve
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /app/apps/api/package.json ./apps/api/

RUN mkdir -p /app/data

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["node", "dist/index.js"]
