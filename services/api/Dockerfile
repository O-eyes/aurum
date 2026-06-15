# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY services/api/package.json ./services/api/
RUN pnpm install --frozen-lockfile

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/ ./packages/
COPY services/api/ ./services/api/
COPY tsconfig.base.json ./
# Generate Prisma client
RUN pnpm --filter @aurum/db run db:generate
# Build packages in dependency order
RUN pnpm --filter @aurum/types run build
RUN pnpm --filter @aurum/db run build
RUN pnpm --filter @aurum/api run build

# ─── Development (hot-reload) ─────────────────────────────────────────────────
FROM deps AS development
COPY packages/ ./packages/
COPY services/api/ ./services/api/
COPY tsconfig.base.json ./
RUN pnpm --filter @aurum/db run db:generate
ENV NODE_ENV=development
EXPOSE 4000 9464
CMD ["pnpm", "--filter", "@aurum/api", "run", "dev"]

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN npm install -g pnpm@9
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 aurum && \
    chown -R aurum:nodejs /app

USER aurum
EXPOSE 4000 9464
CMD ["node", "services/api/dist/main.js"]
