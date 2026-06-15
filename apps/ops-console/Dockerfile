# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/ops-console/package.json ./apps/ops-console/
RUN pnpm install --frozen-lockfile --filter @aurum/ops-console...

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/types/ ./packages/types/
COPY apps/ops-console/ ./apps/ops-console/
COPY tsconfig.base.json ./
RUN pnpm --filter @aurum/types run build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @aurum/ops-console run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/ops-console/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/ops-console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ops-console/.next/static ./apps/ops-console/.next/static

USER nextjs
EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/ops-console/server.js"]
