# Running Aurum locally

This brings up the full stack so you can exercise the end-to-end demo flow
(phone OTP → KYC → buy → mint on testnet → reserve view). It documents the
**demo MVP** path — test-mode payments, testnet chain, stubbed SMS/KYC. See
[§6 What won't work yet](#6-what-wont-work-yet-honest-limits) for the gap between
this and a real-money pilot.

> **Verified state (2026-06-12):** the three Next.js portals build and serve
> clean. The backend has **never been run on this machine** — Docker is not
> installed and Postgres/Redis/Kafka are not present. Everything below is the
> path to change that.

---

## 0. Prerequisites (one-time, requires you)

The entire backend depends on **Postgres + Redis + Kafka**, which exist only in
`docker-compose.infra.yml`. None are installed. You must install Docker first:

1. Install **Docker Desktop for Windows** → https://www.docker.com/products/docker-desktop/
   (or `winget install Docker.DockerDesktop`).
2. Launch it once, accept terms, and enable **WSL2 integration** for your Ubuntu
   distro (Settings → Resources → WSL Integration). A reboot may be required.
3. Confirm it works:
   ```powershell
   docker version        # Server section must print a version
   docker compose version
   ```

Node 24 is already present at `C:\Program Files\nodejs`. pnpm is provided via
corepack (pinned 9.0.0).

---

## 1. Install dependencies & build internal packages (one-time)

`@aurum/db` and `@aurum/types` must be built before the API type-checks/runs.

```powershell
cd C:\Users\amantey\aurum
corepack pnpm install
corepack pnpm --filter @aurum/types build
corepack pnpm --filter @aurum/db build
```

---

## 2. Bring up infrastructure

This starts **only** the infra (Postgres, Redis, Kafka, Kafka-UI, Mailhog,
Prometheus, Loki, Grafana) — not the app containers — so you can run the API
from source with hot reload.

```powershell
cd C:\Users\amantey\aurum
corepack pnpm infra:up        # = docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.infra.yml ps   # all should be healthy
```

Exposed on localhost:

| Service    | Host port | Credentials                          |
|------------|-----------|--------------------------------------|
| Postgres   | `5432`    | `aurum` / `aurum_secret`, db `aurum` |
| Redis      | `6379`    | password `aurum_redis_secret`        |
| Kafka      | `29092`   | (EXTERNAL listener — see gotcha)     |
| Mailhog UI | `8025`    | catches all dev email                |
| Kafka-UI   | (compose) | topic inspector                      |

> ⚠️ **Kafka port gotcha.** Inside Docker the broker is `kafka:9092`. From the
> **host** (where you run the API from source) you must use the EXTERNAL
> listener **`localhost:29092`**. Make sure `services/api/.env` has
> `KAFKA_BROKERS=localhost:29092` — not `9092` — or the API will hang on
> startup trying to reach the broker.

Verify `services/api/.env` host-facing values (the in-Docker values differ):

```
DATABASE_URL=postgresql://aurum:aurum_secret@localhost:5432/aurum
REDIS_URL=redis://:aurum_redis_secret@localhost:6379
KAFKA_BROKERS=localhost:29092
```

---

## 3. Migrate & seed the database

**There are no migrations yet** — the schema was edited directly, so the first
`migrate dev` snapshots the *entire* current schema into a baseline migration
(this covers phone-auth, fee-itemization, and the burn-txhash-unique changes in
one shot).

```powershell
cd C:\Users\amantey\aurum
corepack pnpm --filter @aurum/db db:generate                 # prisma client
corepack pnpm --filter @aurum/db db:migrate:dev --name init  # creates + applies baseline
corepack pnpm --filter @aurum/db db:seed                     # seeds admin user
```

Inspect data anytime with `corepack pnpm --filter @aurum/db db:studio`.

---

## 4. Start the API

```powershell
cd C:\Users\amantey\aurum
corepack pnpm --filter @aurum/api dev      # nest start --watch, port 4000
```

When it logs `Aurum API running on http://0.0.0.0:4000`, open:

- **Swagger UI → http://localhost:4000/docs** (dev-only; full API surface,
  `Authorize` with a Bearer token from the auth endpoints)
- Health → http://localhost:4000/health
- Metrics → http://localhost:4000/metrics

API routes are served under the global prefix (default `api`; `health` is
excluded). Swagger at `/docs` is not prefixed.

---

## 5. Start the frontends

Each in its own terminal (or `corepack pnpm dev` at the root to run all via turbo):

| App                   | Command                                              | URL                    |
|-----------------------|------------------------------------------------------|------------------------|
| Landing               | `corepack pnpm --filter @aurum/landing dev`          | http://localhost:3000  |
| Investor portal       | `corepack pnpm --filter @aurum/investor-portal dev`  | http://localhost:3001  |
| Institutional portal  | `corepack pnpm --filter @aurum/institutional-portal dev` | http://localhost:3002 *(see its package.json -p flag)* |
| Ops console           | `corepack pnpm --filter @aurum/ops-console dev`      | (see its package.json) |

The investor portal's `dev` is pinned to **port 3001**. CORS in
`docker-compose.yml` already allows 3000–3003.

**Smoke test once API + investor portal are up:**

```powershell
# OTP code is printed to the API console (SMS is stubbed — see below)
curl http://localhost:4000/health
# then in the browser: http://localhost:3001/login → enter a phone → read the
# code from the API terminal → you're in.
```

---

## 6. What won't work yet (honest limits)

This is a **demo MVP**, not a real-money pilot. As configured:

| Area              | Current state                                  | Effect on the demo |
|-------------------|------------------------------------------------|--------------------|
| **SMS / OTP**     | stub — code is **logged to the API console**, not sent | Sign-in works; just read the code from the terminal |
| **KYC**           | `KYC_PROVIDER=stub` (Sumsub creds empty); stub **throws in production** | No real ID verification; demo auto-passes/needs manual status |
| **GoldBod**       | API URL/key empty, Paystack subaccount = `ACCT_goldbod_*` placeholder | The split-to-GoldBod leg is **skipped** — no real gold is purchased/settled |
| **Payments**      | Paystack **test** keys (`sk_test_…`)           | Use Paystack test cards/MoMo; no real money moves |
| **Chain**         | `CHAIN_ID=11155111` (Sepolia testnet)          | Mint/burn happen on testnet; tokens aren't real assets |
| **Embedded wallet** | `NEXT_PUBLIC_PRIVY_APP_ID` empty             | Falls back to MetaMask/WalletConnect, not the seedless embedded wallet |
| **Email**         | Mailhog (`localhost:8025`)                     | Verification/notification mail is caught locally, not delivered |

**To progress toward a real pilot**, these need live wiring (partnership/
compliance work, not code): GoldBod settlement + real Paystack subaccount, live
Sumsub KYC, live Paystack keys + MoMo, an SMS provider (Arkesel), a production
chain decision (eval picked Polygon) + real contract deploy, and a Privy app ID.

---

## 7. Tear down

```powershell
corepack pnpm infra:down        # stop infra, keep volumes (data persists)
# or full reset including data:
docker compose -f docker-compose.infra.yml down -v
```

---

## Alternative: full stack in Docker (no source hot-reload)

If you'd rather run *everything* (API + all portals) in containers:

```powershell
corepack pnpm dev:up            # = docker compose -f docker-compose.yml up -d
```

This builds the API image, runs the `migrate` one-shot container automatically,
then starts the API and all web apps. Slower to iterate, but closest to prod.
