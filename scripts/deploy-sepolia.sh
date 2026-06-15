#!/usr/bin/env bash
#
# Deploy AurumToken (UUPS proxy) to Sepolia — or any EVM testnet via overrides.
# ==============================================================================
# Foundry deploy of contracts/script/Deploy.s.sol. Installs the git-submodule
# libs (OpenZeppelin v5 + forge-std) if missing, builds, tests, then broadcasts.
#
# Prereqs:
#   - Foundry installed:  ./server-setup.sh --foundry   (then open a new shell)
#   - Repo is git-initialized (forge install uses git submodules)
#   - Deployer EOA funded with Sepolia ETH (faucet)
#
# Required env (export, or prefix the command):
#   SEPOLIA_RPC_URL        Sepolia RPC endpoint *with your key* (Alchemy/Infura)
#   DEPLOYER_PRIVATE_KEY   funded deployer EOA — pays gas
#   ADMIN_MULTISIG         gets DEFAULT_ADMIN_ROLE + UPGRADER_ROLE (use a Safe in prod)
#   MINTER_HOT_WALLET      MUST equal the address of the API's MINTER_PRIVATE_KEY
#   PAUSER_ADDRESS         ops pause key
# Optional:
#   ETHERSCAN_API_KEY      auto-verify the contract on Etherscan
#   OZ_VERSION             OpenZeppelin tag (default v5.1.0 — contract needs v5)
#   CHAIN_NAME             label only (default: sepolia)
#
# Usage:
#   sed -i 's/\r$//' scripts/deploy-sepolia.sh && chmod +x scripts/deploy-sepolia.sh
#   SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... ADMIN_MULTISIG=0x... \
#   MINTER_HOT_WALLET=0x... PAUSER_ADDRESS=0x... ./scripts/deploy-sepolia.sh
# ==============================================================================
set -euo pipefail

OZ_VERSION="${OZ_VERSION:-v5.1.0}"
CHAIN_NAME="${CHAIN_NAME:-sepolia}"

require() { if [ -z "${!1:-}" ]; then echo "❌ Missing required env: $1" >&2; exit 1; fi; }
require SEPOLIA_RPC_URL
require DEPLOYER_PRIVATE_KEY
require ADMIN_MULTISIG
require MINTER_HOT_WALLET
require PAUSER_ADDRESS

command -v forge >/dev/null 2>&1 || {
  echo "❌ forge not found. Install Foundry: ./server-setup.sh --foundry (then open a new shell)." >&2
  exit 1
}

root="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$root/.git" ] || { echo "❌ Run 'git init' at the repo root first — forge install needs git." >&2; exit 1; }
cd "$root/contracts"

echo "▶ Ensuring contract libs are present…"
[ -d lib/forge-std ]                          || forge install foundry-rs/forge-std --no-commit
[ -d lib/openzeppelin-contracts ]             || forge install "OpenZeppelin/openzeppelin-contracts@${OZ_VERSION}" --no-commit
[ -d lib/openzeppelin-contracts-upgradeable ] || forge install "OpenZeppelin/openzeppelin-contracts-upgradeable@${OZ_VERSION}" --no-commit

echo "▶ Building…";  forge build
echo "▶ Testing…";   forge test

VERIFY_ARGS=()
if [ -n "${ETHERSCAN_API_KEY:-}" ]; then
  VERIFY_ARGS=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
  echo "▶ Etherscan verification: ON"
else
  echo "▶ Etherscan verification: OFF (set ETHERSCAN_API_KEY to enable)"
fi

echo "▶ Deploying AurumToken to ${CHAIN_NAME}…"
ADMIN_MULTISIG="$ADMIN_MULTISIG" \
MINTER_HOT_WALLET="$MINTER_HOT_WALLET" \
PAUSER_ADDRESS="$PAUSER_ADDRESS" \
forge script script/Deploy.s.sol:DeployAurumToken \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  "${VERIFY_ARGS[@]}"

cat <<'EOF'

──────────────────────────────────────────────────────────────────────────────
✅ Deploy broadcast complete. NOW DO THIS:

1. From the log above, copy the "AurumToken proxy (use this)" address
   (the PROXY — NOT the implementation).

2. services/api/.env:
     AURUM_TOKEN_ADDRESS=<proxy address>
     CHAIN_ID=11155111
     RPC_URL=<the SAME Sepolia endpoint used here>

3. Sanity checks before the first mint:
     - address(MINTER_PRIVATE_KEY)  ==  MINTER_HOT_WALLET   (else mint() reverts)
     - the minter wallet holds Sepolia ETH for gas
     - frontend NEXT_PUBLIC_CHAIN_ID == 11155111 and was rebuilt

4. Broadcast artifacts are in contracts/broadcast/ (git-ignored). Keep the
   proxy address recorded somewhere durable.
──────────────────────────────────────────────────────────────────────────────
EOF
