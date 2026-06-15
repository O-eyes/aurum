# Embedded Wallet Provider & Chain Evaluation

**Date:** June 2026 · **Status:** Draft for decision
**Context:** Aurum is a non-custodial tokenization infrastructure layer. Users (mainstream
Ghanaians, MoMo-first, no crypto experience) must receive AUR gold tokens in a wallet they
control, created invisibly at signup from a phone/email login. Aurum must never hold
unilateral key control (custody classification) and never hold customer cash
(split-at-source settlement to GoldBod). White-label multi-tenant is a core ambition.

---

## Part 1 — Embedded wallet provider

### Requirements

| # | Requirement | Why |
|---|-------------|-----|
| R1 | Phone/SMS login that works reliably for +233 numbers | MoMo-first audience; phone is the identity anchor |
| R2 | Non-custodial key architecture (no unilateral provider/Aurum control) | Keeps Aurum a tech vendor, not a custodian |
| R3 | User key export | Strengthens the self-custody argument; exit path |
| R4 | Predictable per-MAU cost at GH₵15-order economics | Retail margins are thin |
| R5 | Multi-tenant / white-label support | Each tenant brings own branding + config |
| R6 | EVM + wagmi/viem compatibility | Existing stack (Next.js 14, wagmi, viem) |
| R7 | Fast integration | Small team, many workstreams |

### Candidates

| | **Privy** | **Web3Auth** | **Turnkey** |
|---|---|---|---|
| Key architecture | TEE + Shamir secret sharing — no single party holds the full key | MPC (threshold shares across auth factors) | Keys live entirely in hardware enclaves (TEE), never leave |
| Custody posture | Self-custodial (user auth factor required to sign) | Self-custodial MPC | Closer to policy-controlled custody; raw key export **not** default |
| Key export (R3) | ✅ Any time | ✅ Supported | ❌ Not by default |
| SMS/phone login (R1) | ✅ Native (email, SMS, social, passkey) | ✅ Supported | ⚠️ Bring-your-own auth (we'd build OTP — which we are anyway) |
| Pricing (R4) | Free < 500 MAU; ~$299/mo to 2,500 MAU; usage-based past 10K MAU / 50K signatures / $1M volume | Comparable tiered MAU pricing; historically the cost alternative | Usage/signature-based; enterprise-leaning |
| Signing latency | Fast | ~500ms+ (MPC ceremony) | 50–100 ms (fastest) |
| Integration speed (R7) | Hours–days; first-class React/wagmi SDK | Days; mature SDKs | Weeks–months; lower-level API |
| White-label (R5) | Per-app branding, multi-app accounts | Strong white-label heritage (wallet-as-a-service) | Full control (you build the UX) |
| Vendor risk | **Acquired by Stripe (2025)** — deep pockets, but stablecoin/Bridge lock-in concerns | **Acquired by MetaMask/Consensys** | Independent, Coinbase-custody pedigree |

### Recommendation: **Privy primary, Web3Auth fallback**

- Privy hits R1–R7 with the least friction: native SMS login, TEE+SSS self-custodial
  architecture with user export, React SDK that drops into the existing wagmi setup, and a
  free tier that covers the pilot entirely (<500 MAU).
- The Stripe acquisition cuts both ways: long-term viability is excellent; the risk is
  ecosystem lock-in. Mitigation = R3 (key export) is a real exit, and our integration
  should sit behind a thin `WalletProvider` abstraction (same pattern as `PaymentProvider`
  / `KycProvider` already in the API) so swapping to Web3Auth is a bounded change.
- Turnkey is the wrong shape for this product: best-in-class signing infra, but no default
  key export weakens the non-custody story, and integration cost is the highest.

**Pilot gate (must pass before commitment):**
1. SMS OTP deliverability test to +233 MTN / Telecel / AirtelTigo numbers (Privy POC).
2. Written confirmation of pricing at 10K/50K/250K MAU projections.
3. Confirm key-export UX and multi-tenant app isolation for white-label.

---

## Part 2 — Chain

### Requirements

- Per-mint cost must be negligible against a **GH₵15 (~$1) minimum order** — rules out
  Ethereum mainnet (dollars per mint) immediately.
- EVM, Solidity 0.8.24 contract deploys unchanged; viem/wagmi support.
- Credible to institutional partners + auditors (proof-of-reserve reporting on-chain).
- Stable, liquid, likely to exist in 5 years.

### Candidates

| | **Polygon PoS** | **Base** | Ethereum mainnet |
|---|---|---|---|
| ERC-20 transfer/mint cost | ~$0.0001–$0.01 | ~$0.002–$0.05 | $1–$10+ ❌ |
| Cost vs GH₵15 order | ~0.001–1% ✅ | ~0.2–5% ✅ | Order-killing ❌ |
| Maturity / RWA usage | Long track record; widely used for emerging-market RWA | Newer (2023), fastest-growing L2 | Gold standard, wrong economics |
| Operator/centralization optics | Polygon Labs; PoS validator set | **Coinbase-operated sequencer** | Most neutral |
| Already in codebase | ✅ (`wagmi.ts` ships polygon chain; viem) | viem-supported, config addition | ✅ (current default config) |
| Testnet | Amoy | Base Sepolia | Sepolia (current default) |

### Recommendation: **Polygon PoS** (Base as documented alternative)

- Cheapest per-mint by an order of magnitude — at fractions of a cent, even GH₵15 buys
  with per-user mints are economically trivial, and batching becomes an optimization, not
  a survival requirement.
- Already wired in the investor portal's wagmi config; mint service needs only the chain
  added to its resolver.
- For a product carrying a **state partner (GoldBod)**, a Coinbase-operated sequencer
  (Base) is an avoidable perception/sovereignty question. Polygon's longer RWA track
  record reads better in audit/compliance documents.
- Revisit if: Polygon fee market degrades, or a tenant/white-label client mandates Base —
  the `chainId` config pattern already supports per-tenant chains.

### Cost sanity check

Mint ≈ 65–100K gas. At Polygon's observed averages → **well under $0.01/mint**, i.e.
<1% of the minimum order; amortized to ~0% at typical order sizes. Add an ops alert if
per-mint cost ever exceeds 1% of minimum order value.

---

## Part 3 — Decisions requested

| Decision | Recommendation | Owner |
|---|---|---|
| Embedded wallet provider | Privy (behind a `WalletProvider` abstraction), Web3Auth fallback | Eng + Founder sign-off |
| Chain | Polygon PoS (Amoy testnet), per-tenant override supported | Eng + Founder sign-off |
| Pilot gates before commitment | +233 SMS POC · pricing confirmation · key-export check | Eng |

**Sources:** [Privy pricing](https://www.privy.io/pricing) · [Privy features](https://www.privy.io/features) ·
[Openfort: Privy alternatives 2026](https://www.openfort.io/blog/privy-alternatives) ·
[Openfort: Turnkey alternatives 2026](https://www.openfort.io/blog/turnkey-alternatives) ·
[Fireblocks embedded wallet comparison](https://www.fireblocks.com/report/compare-embedded-wallet-infrastructure) ·
[Polygon gas tracker](https://polygonscan.com/gastracker) · [Base network fees](https://docs.base.org/base-chain/network-information/network-fees) ·
[Ethereum gas statistics 2026](https://sqmagazine.co.uk/ethereum-gas-fees-statistics/)
