# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/institutional-portal/package.json ./apps/institutional-portal/
RUN pnpm install --frozen-lockfile --filter @aurum/institutional-portal...

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/types/ ./packages/types/
COPY apps/institutional-portal/ ./apps/institutional-portal/
COPY tsconfig.base.json ./
RUN pnpm --filter @aurum/types run build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHAIN_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
RUN pnpm --filter @aurum/institutional-portal run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/institutional-portal/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/institutional-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/institutional-portal/.next/static ./apps/institutional-portal/.next/static

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/institutional-portal/server.js"]
