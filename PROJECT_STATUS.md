# Aurum — Project Status

> **Last updated:** 2026-06-10
> **Stack:** NestJS · Next.js · Prisma/PostgreSQL · Kafka · Redis · Solidity/Foundry · pnpm monorepo

---

## What Aurum Is

A gold-backed token platform. Users buy tokens representing physical gold, hold/trade them as ERC-20s, and redeem them for cash or physical delivery. The platform handles KYC, order flow, payment processing, on-chain minting/burning, reserve tracking, and compliance audit trails.

---

## Repository Layout

```
aurum/
├── apps/
│   ├── investor-portal/        # Retail investor UI (Next.js, port 3001)
│   ├── institutional-portal/   # Institutional client UI (Next.js, port 3002)
│   └── ops-console/            # Ops/compliance dashboard (Next.js, port 3003)
├── services/
│   └── api/                    # Core backend (NestJS/Fastify)
├── packages/
│   ├── db/                     # Prisma schema + migrations
│   └── types/                  # Shared TypeScript types
├── contracts/                  # Solidity (Foundry)
├── infra/                      # Grafana, Loki, Prometheus configs
├── docker-compose.yml
└── docker-compose.infra.yml
```

---

## Built — Completed Work

### Backend API (`services/api`)

| Area                             | Status  | Notes                                                                                                                                           |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Project scaffold                 | ✅ Done | NestJS + Fastify, global guards/filters/interceptors, Helmet, CORS, rate limiting                                                               |
| JWT auth (email/password)        | ✅ Done | Register → verify email → login/logout, refresh tokens, JWT blacklist on logout                                                                 |
| SIWE wallet auth                 | ✅ Done | Challenge/verify flow, nonce stored in Redis, wallet linking to user accounts                                                                   |
| User profiles & wallets          | ✅ Done | Profile retrieval, multiple wallets per user, wallet removal with audit trail                                                                   |
| KYC module                       | ✅ Done | Full state machine (PENDING → UNDER_REVIEW → APPROVED/REJECTED/NEEDS_REVIEW), compliance officer review endpoints, webhook handler, KYC history |
| Audit event system               | ✅ Done | Append-only audit log, 20+ action types, before/after snapshots, IP/UA capture, Kafka fan-out                                                   |
| Kafka event bus                  | ✅ Done | KRaft-mode Kafka, structured message format, topics for every domain event                                                                      |
| Redis service                    | ✅ Done | Nonce storage, JWT blacklist, generic key-value with TTL                                                                                        |
| Database layer                   | ✅ Done | Prisma schema covering all entities, Postgres 16                                                                                                |
| Observability                    | ✅ Done | Prometheus metrics endpoint, Loki log aggregation, Grafana dashboards (infra only)                                                              |
| Request traceability             | ✅ Done | Request ID middleware, audit interceptor, structured logging                                                                                    |
| Role-based access                | ✅ Done | USER, ADMIN, COMPLIANCE, TREASURY, SYSTEM roles enforced via guards                                                                             |
| Gold price feed                  | ✅ Done | GoldBod API integration with 5-min Redis cache; `GoldPriceService.refresh()` for ops                                                            |
| Ledger module                    | ✅ Done | `credit()`, `debit()` with before/after balance snapshots; composable inside Prisma transactions                                                |
| Orders module                    | ✅ Done | Create BUY/SELL with KYC gate + idempotency; full state machine; Kafka + audit events; ops list endpoint                                        |
| Payments — Paystack card         | ✅ Done | `POST /orders/:id/pay/card` → Paystack initialize; webhook confirms payment; drives order state                                                 |
| Payments — Mobile money          | ✅ Done | `POST /orders/:id/pay/mobile-money` (MTN/Vodafone/Tigo/Airtel via Paystack Charge API); HMAC-SHA512 webhook verification                        |
| Mint module                      | ✅ Done | viem hot-wallet submits `mint()` on AurumToken; MintRequest tracked with txHash; `confirmMint` credits ledger                                   |
| Burn/redemption module           | ✅ Done | `createBurnRequest` returns on-chain call for user to sign; `confirmBurn` processes txHash                                                      |
| Mint confirmation automation     | ✅ Done | `MintConfirmatorService` cron (every 30s) auto-confirms/fails SUBMITTED mint + burn txs on-chain                                                |
| Reserve snapshots                | ✅ Done | Manual (`POST /reserve/snapshot`) + hourly cron; GoldBod vault for gold oz; on-chain or ledger totalSupply; Kafka backing-ratio alert           |
| Paystack transfers / SELL payout | ✅ Done | `PayoutsService`: Paystack recipient creation, transfer initiation, `transfer.*` webhook handling, ledger debit                                 |
| Sumsub KYC provider              | ✅ Done | HMAC-SHA256 request signing, applicant + SDK token creation, webhook verification, review status mapping                                        |

### Smart Contracts (`contracts/`)

| Contract            | Status  | Notes                                                                                                                |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| AurumToken (ERC-20) | ✅ Done | UUPS upgradeable, mintable by authorized hot-wallet, burnable (redemption), pausable, order ID traceability on-chain |

### Database Schema (`packages/db`)

All tables defined and migrated:

- `users`, `wallets`, `sessions`, `email_verifications`
- `kyc_profiles`, `kyc_history`
- `orders`, `payments`, `mint_requests`, `burn_requests`
- `ledger_entries`
- `audit_events` (append-only)
- `reserve_snapshots`

### Infrastructure

- Docker Compose for full local stack (Postgres, Redis, Kafka, Mailhog, Prometheus, Loki, Grafana)
- Turbo monorepo build orchestration
- pnpm workspaces

---

## In Progress / Partially Built

| Area           | Status          | What Exists                                                            | What's Missing                                |
| -------------- | --------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Frontend apps  | ✅ Done         | All 3 portals fully built — auth, KYC, orders, dashboard, payout flows | —                                             |
| Email delivery | 🟡 Logging only | Verification token generation, Mailhog for local                       | SMTP/transactional email provider integration |

---

## Not Started — Recommended Next Steps

Prioritized by dependency order (each layer unblocks the next):

### Priority 1 — Core Business Logic (Backend)

- [x] **Orders service & controller** — Done
- [x] **Ledger service** — Done
- [x] **Payment processor** — Done (Paystack card + mobile money)
- [x] **Mint execution service** — Done (viem hot-wallet)
- [x] **Burn/redemption service** — Done
- [x] **Reserve snapshot service** — Done (manual + hourly cron)

### Priority 2 — Data & Reliability

- [x] **Gold price feed** — Done (GoldBod + Redis cache)
- [x] **Idempotency enforcement** — Done
- [x] **Real KYC provider (Sumsub)** — Done (set `KYC_PROVIDER=sumsub`)
- [x] **Mint confirmation automation** — Done (30s cron)
- [x] **Paystack transfer/disbursement** — Done (SELL payout flow)
- [ ] **Transaction saga / compensation** — If mint fails after payment, trigger refund
- [ ] **Email delivery** — SMTP/transactional for verification, order confirmation, KYC status

### Priority 3 — Frontends

- [x] **Investor portal** — Auth (email + SIWE wallet), KYC wizard, buy/sell order forms, portfolio dashboard, order history, order detail with payment
- [x] **Ops console** — KYC review queue with approve/reject, order management with filters, reserve dashboard (manual snapshot), audit log viewer, user management
- [x] **Institutional portal** — Dashboard, bulk order form (inline), order history, CSV export/reporting, institutional KYC flow

### Priority 4 — Production Readiness

- [ ] **Test suite** — Unit tests (services/guards/pipes), integration tests against real DB (no mocks per project convention), E2E for critical flows (register → KYC → buy → mint)
- [ ] **Email service** — SendGrid or Postmark for verification emails, order confirmations, KYC status notifications
- [ ] **Secrets & env management** — Production `.env` setup, secrets manager (AWS Secrets Manager or HashiCorp Vault)
- [ ] **Grafana alerting rules** — Price deviation alerts, backing ratio below threshold, failed mint/burn alerts
- [ ] **CI/CD pipeline** — GitHub Actions (or similar): lint, typecheck, test, build, container publish
- [ ] **Contract deployment scripts** — Foundry deploy + verify scripts for testnet and mainnet
- [ ] **Admin: user management** — ADMIN role endpoints to suspend/unsuspend users, force KYC re-review

---

## API Endpoints (Current)

```
POST   /api/v1/auth/register
GET    /api/v1/auth/verify-email
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/wallet/challenge
POST   /api/v1/auth/wallet/verify

GET    /api/v1/users/me
GET    /api/v1/users/me/balance
GET    /api/v1/users/me/wallets
DELETE /api/v1/users/me/wallets/:walletId

GET    /api/v1/kyc/status
POST   /api/v1/kyc/submit
GET    /api/v1/kyc/review              (COMPLIANCE only)
POST   /api/v1/kyc/:id/approve         (COMPLIANCE only)
POST   /api/v1/kyc/:id/reject          (COMPLIANCE only)
POST   /api/v1/kyc/webhook             (public, sig-verified)

POST   /api/v1/orders                  (create BUY or SELL)
GET    /api/v1/orders/me               (list user's orders)
GET    /api/v1/orders/me/:orderId      (get single order)
DELETE /api/v1/orders/me/:orderId      (cancel order)
GET    /api/v1/orders                  (ADMIN/TREASURY/COMPLIANCE — list all)

POST   /api/v1/orders/:orderId/pay/card          (initiate Paystack card payment)
POST   /api/v1/orders/:orderId/pay/mobile-money  (initiate Paystack mobile money)
POST   /api/v1/payments/webhook/paystack         (public, Paystack webhook)

POST   /api/v1/mint/request/:orderId   (TREASURY/ADMIN — submit mint tx)
POST   /api/v1/mint/confirm            (TREASURY/ADMIN — confirm mint tx)
POST   /api/v1/mint/burn/request/:orderId  (user — create burn request, get on-chain call)
POST   /api/v1/mint/burn/confirm       (user — confirm burn txHash)

POST   /api/v1/orders/:orderId/payout/method   (set bank/mobile-money payout for SELL)
POST   /api/v1/orders/:orderId/payout/initiate (trigger transfer after burn confirmed)

GET    /api/v1/reserve/snapshot/latest  (TREASURY/COMPLIANCE/ADMIN)
GET    /api/v1/reserve/snapshot/history (TREASURY/COMPLIANCE/ADMIN)
POST   /api/v1/reserve/snapshot         (TREASURY/ADMIN — manual snapshot)

GET    /health
GET    /metrics
```

---

## Kafka Topics

| Topic            | Events                                                         |
| ---------------- | -------------------------------------------------------------- |
| `user.events`    | user.created, email.verified                                   |
| `wallet.events`  | wallet.linked                                                  |
| `kyc.events`     | kyc.status-changed, kyc.approved                               |
| `order.events`   | order.created, order.status-changed                            |
| `token.ops`      | mint.requested, mint.confirmed, burn.requested, burn.confirmed |
| `payment.events` | payment.confirmed, payment.failed                              |
| `reserve.alerts` | backing-ratio.low                                              |
| `audit.events`   | all audit actions (SIEM fan-out)                               |

---

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-10 | Initial PROJECT_STATUS.md created — analysis of existing build, full roadmap drafted                                                                                                                                                                                                                 |
| 2026-06-10 | Backend layer 1 complete — Gold price (GoldBod+Redis), Ledger, Orders, Payments (Paystack card + mobile money), Mint/Burn (viem hot-wallet). Prisma schema extended. 20+ new files.                                                                                                                  |
| 2026-06-11 | Backend layer 2 complete — Reserve snapshots (manual + hourly cron), Mint confirmation automation (30s cron), Paystack transfers/SELL payout, Sumsub KYC provider. Backend feature-complete.                                                                                                         |
| 2026-06-11 | All 3 frontend portals built — Investor portal (auth, KYC, buy/sell, dashboard, Paystack payment flows, SIWE wallet), Ops console (KYC review, orders, reserve, audit log, users), Institutional portal (orders, reporting + CSV export, KYC). Tailwind, React Hook Form, TanStack Query throughout. |
