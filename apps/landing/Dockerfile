# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/landing/package.json ./apps/landing/
RUN pnpm install --frozen-lockfile --filter @aurum/landing...

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/landing/ ./apps/landing/
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_INVESTOR_URL
ARG NEXT_PUBLIC_INSTITUTIONAL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_INVESTOR_URL=$NEXT_PUBLIC_INVESTOR_URL
ENV NEXT_PUBLIC_INSTITUTIONAL_URL=$NEXT_PUBLIC_INSTITUTIONAL_URL
RUN pnpm --filter @aurum/landing run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/landing/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./apps/landing/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/landing/server.js"]
