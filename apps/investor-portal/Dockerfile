# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/investor-portal/package.json ./apps/investor-portal/
RUN pnpm install --frozen-lockfile --filter @aurum/investor-portal...

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/types/ ./packages/types/
COPY apps/investor-portal/ ./apps/investor-portal/
COPY tsconfig.base.json ./
RUN pnpm --filter @aurum/types run build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_EXPLORER_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
ENV NEXT_PUBLIC_EXPLORER_URL=$NEXT_PUBLIC_EXPLORER_URL
RUN pnpm --filter @aurum/investor-portal run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/investor-portal/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/investor-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/investor-portal/.next/static ./apps/investor-portal/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/investor-portal/server.js"]
