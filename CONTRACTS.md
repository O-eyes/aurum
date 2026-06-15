# Smart contracts — deploy & operate

`AurumToken` is the on-chain representation of vault-held gold: an **ERC-20,
18-decimal, UUPS-upgradeable** token. All business logic (KYC, reserve
accounting, compliance) is **off-chain** — the contract only enforces *who can
mint/burn* and *pause*.

- Source: [contracts/src/AurumToken.sol](contracts/src/AurumToken.sol)
- Deploy script: [contracts/script/Deploy.s.sol](contracts/script/Deploy.s.sol)
- Toolchain: Foundry (forge), Solidity 0.8.24, OpenZeppelin **v5**

---

## Roles (set at `initialize`, behind the proxy)

| Role | Granted to | Can |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `ADMIN_MULTISIG` | grant/revoke all roles |
| `UPGRADER_ROLE` | `ADMIN_MULTISIG` | **replace the implementation** (UUPS) |
| `MINTER_ROLE` | `MINTER_HOT_WALLET` | `mint(to, amount, orderId)` |
| `PAUSER_ROLE` | `PAUSER_ADDRESS` | `pause()` / `unpause()` |

> ⚠️ **`UPGRADER_ROLE` can swap the contract's entire logic.** On testnet a
> single EOA is fine. For production (Polygon), `ADMIN_MULTISIG` **must** be a
> Gnosis Safe — it is the single largest trust assumption in the system.

---

## Deploy to Sepolia

```bash
# 1. Install Foundry (once), then open a NEW shell so `forge` is on PATH:
./scripts/server-setup.sh --foundry

# 2. Fund the DEPLOYER address with Sepolia ETH (faucet, e.g. sepoliafaucet.com).

# 3. Deploy (strip CRLF first if the file came from Windows):
sed -i 's/\r$//' scripts/deploy-sepolia.sh && chmod +x scripts/deploy-sepolia.sh

SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<KEY>" \
DEPLOYER_PRIVATE_KEY="0x<deployer>" \
ADMIN_MULTISIG="0x<safe-or-eoa>" \
MINTER_HOT_WALLET="0x<address of the API's MINTER_PRIVATE_KEY>" \
PAUSER_ADDRESS="0x<ops>" \
ETHERSCAN_API_KEY="<optional, to verify>" \
./scripts/deploy-sepolia.sh
```

The script installs the OZ/forge-std submodules, builds, runs tests, broadcasts,
and prints the **proxy** address. The helper auto-handles the lib install — but
note `contracts/lib/` is git-ignored, so it's re-fetched per machine.

### After deploy — wire the backend

In `services/api/.env`:
```
AURUM_TOKEN_ADDRESS=<PROXY address — not the implementation>
CHAIN_ID=11155111
RPC_URL=<the SAME Sepolia endpoint you deployed with>
```

---

## Gotchas (the ones that actually bite)

1. **Use the PROXY address, not the implementation.** The deploy logs both;
   the API must call the proxy or state/upgrades won't line up.

2. **`MINTER_HOT_WALLET` must equal `address(MINTER_PRIVATE_KEY)`.** The API
   signs mints with `MINTER_PRIVATE_KEY`; if that address wasn't granted
   `MINTER_ROLE` at deploy, every `mint()` reverts with an AccessControl error.
   Derive the address with `cast wallet address --private-key 0x...`.

3. **RPC/chain must agree everywhere.** Backend `CHAIN_ID` + `RPC_URL`, the
   deployed network, and frontend `NEXT_PUBLIC_CHAIN_ID` must all match. The
   current `.env` ships `RPC_URL` pointing at **mainnet** with a placeholder key
   while `CHAIN_ID=11155111` — fix that or nothing mints.

4. **Keep the minter funded.** Mint/burn cost gas. An empty hot wallet =
   silent mint failures. Add a low-balance alert.

5. **The peg is off-chain.** The token is 18-decimal; "1 AURUM = X grams of
   gold" is enforced by the backend, not the contract. Backend mint-amount math
   and reserve accounting must agree on the peg.

6. **Public RPCs rate-limit.** Use a keyed Alchemy/Infura endpoint, not a public
   node, or you'll get intermittent dropped transactions.

---

## Sepolia vs. production (Polygon)

The provider/chain evaluation chose **Polygon PoS** for production. Sepolia
(Ethereum testnet) is a fine generic-EVM smoke test, but it does **not**
exercise Polygon-specific behavior (gas token, fee dynamics, finality, reorgs).

For closer parity, deploy/test on **Polygon Amoy (chain 80002)** instead:
```bash
SEPOLIA_RPC_URL="https://polygon-amoy.g.alchemy.com/v2/<KEY>" \
CHAIN_NAME="polygon-amoy" \
... ./scripts/deploy-sepolia.sh   # then set CHAIN_ID=80002 in the API + frontend
```

Whichever you choose, redeploying later means re-setting all three chain values
(`CHAIN_ID`, `RPC_URL`, `AURUM_TOKEN_ADDRESS`) and rebuilding the frontend.

---

## Operating notes

- **Pause** is the emergency brake: `cast send <proxy> "pause()" --private-key 0x<pauser> --rpc-url <rpc>`.
- **Upgrades** go through `UPGRADER_ROLE` and UUPS `_authorizeUpgrade`; test the
  new implementation's storage layout compatibility before upgrading.
- **Verify on the explorer** (`ETHERSCAN_API_KEY`) so the deployed bytecode is
  publicly auditable — this backs the "open for independent audit" claim.
