#!/usr/bin/env bash
#
# Aurum server bootstrap — Ubuntu (20.04 / 22.04 / 24.04)
# ------------------------------------------------------------------------------
# Installs every host dependency the Aurum stack needs, then verifies each one
# against the required minimum version and prints a PASS/FAIL table.
#
# Usage:
#   ./server-setup.sh            install everything, then verify
#   ./server-setup.sh --check    verify only (no install) — run this to audit
#   ./server-setup.sh --project  after verify, bootstrap the repo end-to-end:
#                                 pnpm install + build pkgs + prisma generate +
#                                 infra up + baseline migration + seed admin.
#   ./server-setup.sh --foundry  also install Foundry (forge/cast) for deploying
#                                 the smart contract. Not needed to RUN the app —
#                                 only to deploy/verify contracts. See CONTRACTS.md.
#
# Install phase also hardens the host: Docker log rotation + swap (OOM guard).
#
# Re-runnable: skips anything already satisfied. Requires sudo for installs.
# ==============================================================================
set -euo pipefail

# ── Requirements (single source of truth) ────────────────────────────────────
REQ_NODE_MIN="20.0.0"      # repo engines: node >=20; Dockerfile uses node:20
REQ_PNPM_VER="9.0.0"       # repo packageManager: pnpm@9.0.0
REQ_DOCKER_MIN="24.0.0"    # Docker Engine with buildx + compose v2 plugin
REQ_COMPOSE_MIN="2.20.0"   # `docker compose` (v2 plugin, not legacy v1)
NODE_MAJOR="20"            # NodeSource channel to install

MODE="install"            # install | check
DO_PROJECT="no"
DO_FOUNDRY="no"
for arg in "${@:-}"; do
  case "$arg" in
    --check)   MODE="check" ;;
    --project) DO_PROJECT="yes" ;;
    --foundry) DO_FOUNDRY="yes" ;;
    "" )       : ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

# ── Pretty output ─────────────────────────────────────────────────────────────
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }
log()   { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

FAILS=0
RESULTS=()   # "name|status|detail"

record() { RESULTS+=("$1|$2|$3"); [ "$2" = "FAIL" ] && FAILS=$((FAILS+1)) || true; }

# Compare versions using dpkg (always present on Ubuntu). ver_ge A B → A >= B
ver_ge() { dpkg --compare-versions "$1" ge "$2"; }

require_ubuntu() {
  if ! command -v apt-get >/dev/null 2>&1; then
    red "This script targets Ubuntu/Debian (apt-get not found).\n"; exit 1
  fi
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

# ── Install steps ─────────────────────────────────────────────────────────────
install_base() {
  log "Base packages (git, build tools, openssl, curl, ca-certificates)"
  $SUDO apt-get update -y
  $SUDO apt-get install -y \
    ca-certificates curl gnupg lsb-release git \
    build-essential python3 \
    openssl   # Prisma 5 needs libssl at runtime
}

install_node() {
  if command -v node >/dev/null 2>&1 && ver_ge "$(node -v | sed 's/^v//')" "$REQ_NODE_MIN"; then
    yellow "Node $(node -v) already satisfies >= $REQ_NODE_MIN — skipping.\n"; return
  fi
  log "Node.js ${NODE_MAJOR}.x LTS (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
}

install_pnpm() {
  log "pnpm ${REQ_PNPM_VER} via corepack"
  $SUDO corepack enable
  corepack prepare "pnpm@${REQ_PNPM_VER}" --activate
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    yellow "Docker + compose plugin already present — skipping repo setup.\n"
  else
    log "Docker Engine + Compose v2 plugin (official Docker apt repo)"
    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin
  fi
  # Run docker as non-root
  if ! id -nG "$USER" | grep -qw docker; then
    log "Adding $USER to the 'docker' group (re-login required to take effect)"
    $SUDO usermod -aG docker "$USER"
    yellow "NOTE: log out/in (or run 'newgrp docker') before docker works without sudo.\n"
  fi
  $SUDO systemctl enable --now docker || true
}

install_foundry() {
  if command -v forge >/dev/null 2>&1; then
    yellow "Foundry ($(forge --version 2>/dev/null | head -1)) already installed — skipping.\n"; return
  fi
  log "Foundry (forge/cast/anvil) — for contract deploy/verify only"
  curl -L https://foundry.paradigm.xyz | bash
  # The installer drops 'foundryup' in ~/.foundry/bin and edits your shell rc.
  export PATH="$HOME/.foundry/bin:$PATH"
  if [ -x "$HOME/.foundry/bin/foundryup" ]; then "$HOME/.foundry/bin/foundryup"; else foundryup; fi
  yellow "NOTE: open a new shell (or source your rc) so 'forge' is on PATH.\n"
}

configure_docker_logging() {
  log "Docker log rotation (/etc/docker/daemon.json) — keeps Kafka/PG logs from filling disk"
  if [ -f /etc/docker/daemon.json ]; then
    yellow "/etc/docker/daemon.json already exists — leaving it untouched.\n"
    yellow "Ensure it sets log-opts max-size/max-file yourself.\n"
    return
  fi
  $SUDO mkdir -p /etc/docker
  printf '%s\n' \
    '{' \
    '  "log-driver": "json-file",' \
    '  "log-opts": { "max-size": "10m", "max-file": "3" }' \
    '}' | $SUDO tee /etc/docker/daemon.json >/dev/null
  $SUDO systemctl restart docker || true
}

configure_swap() {
  log "Swap (prevents OOM-kill during Next.js production builds)"
  if [ -n "$(swapon --show 2>/dev/null)" ]; then
    yellow "Swap already active — skipping.\n"; return
  fi
  local size="${SWAP_SIZE:-4G}"
  if ! $SUDO fallocate -l "$size" /swapfile 2>/dev/null; then
    $SUDO dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  fi
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '/swapfile' /etc/fstab 2>/dev/null || \
    echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  green "Swap ($size) enabled.\n"
}

# ── Verification ──────────────────────────────────────────────────────────────
check_cmd_version() {  # name  command-to-get-version  min-version
  local name="$1" getver="$2" min="$3" have
  if ! command -v "${getver%% *}" >/dev/null 2>&1; then
    record "$name" "FAIL" "not installed"; return
  fi
  have="$(eval "$getver" 2>/dev/null || true)"
  if [ -z "$have" ]; then record "$name" "FAIL" "version unreadable"; return; fi
  if ver_ge "$have" "$min"; then record "$name" "PASS" "$have (need >= $min)"
  else record "$name" "FAIL" "$have (need >= $min)"; fi
}

verify_all() {
  log "Verifying requirements"

  check_cmd_version "Node.js"        "node -v | sed 's/^v//'"                  "$REQ_NODE_MIN"
  # pnpm: require exact-or-newer than pinned packageManager
  check_cmd_version "pnpm"           "pnpm -v"                                  "$REQ_PNPM_VER"
  check_cmd_version "Docker Engine"  "docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1" "$REQ_DOCKER_MIN"
  check_cmd_version "Docker Compose" "docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1" "$REQ_COMPOSE_MIN"

  # Presence-only checks
  for c in git openssl gcc make; do
    if command -v "$c" >/dev/null 2>&1; then record "$c" "PASS" "$($c --version 2>/dev/null | head -1)"
    else record "$c" "FAIL" "not installed"; fi
  done

  # Docker daemon reachable?
  if docker info >/dev/null 2>&1; then record "docker daemon" "PASS" "reachable"
  elif sudo docker info >/dev/null 2>&1; then record "docker daemon" "PASS" "reachable (via sudo — re-login for groupless access)"
  else record "docker daemon" "FAIL" "not reachable (is it started? is your user in the docker group?)"; fi

  # Port availability (warn-only; infra + apps need these)
  log "Port availability (informational — must be FREE before bring-up)"
  local ports=(4000 3000 3001 3002 3003 5432 6379 29092 8025)
  for p in "${ports[@]}"; do
    if ss -ltn "( sport = :$p )" 2>/dev/null | grep -q ":$p"; then
      printf "  %-6s %s\n" "$p" "$(yellow 'IN USE')"
    else
      printf "  %-6s %s\n" "$p" "$(green 'free')"
    fi
  done
}

print_table() {
  log "Requirements summary"
  printf "  %-18s %-6s %s\n" "REQUIREMENT" "STATUS" "DETAIL"
  printf "  %-18s %-6s %s\n" "-----------" "------" "------"
  for row in "${RESULTS[@]}"; do
    IFS='|' read -r name status detail <<< "$row"
    if [ "$status" = "PASS" ]; then status="$(green PASS)"; else status="$(red FAIL)"; fi
    printf "  %-18s %-6b %s\n" "$name" "$status" "$detail"
  done
}

# ── Optional: bootstrap the repo end-to-end ───────────────────────────────────
wait_for_postgres() {
  echo "Waiting for Postgres to accept connections…"
  for _ in $(seq 1 30); do
    if docker compose -f docker-compose.infra.yml exec -T postgres pg_isready -U aurum >/dev/null 2>&1; then
      echo "Postgres ready."; return 0
    fi
    sleep 2
  done
  red "Postgres did not become ready in time.\n"; return 1
}

bootstrap_project() {
  local root; root="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$root"

  log "Installing deps + building internal packages"
  corepack pnpm install
  corepack pnpm --filter @aurum/types build
  corepack pnpm --filter @aurum/db build
  corepack pnpm --filter @aurum/db db:generate

  # Prisma needs DATABASE_URL; default to the local infra Postgres.
  export DATABASE_URL="${DATABASE_URL:-postgresql://aurum:aurum_secret@localhost:5432/aurum}"

  # DB steps require a reachable Docker daemon.
  if ! docker info >/dev/null 2>&1; then
    yellow "Docker not reachable as this user yet (group change needs re-login).\n"
    yellow "Finish the DB steps after 'newgrp docker' or re-login:\n"
    echo   "  pnpm infra:up"
    echo   "  DATABASE_URL=$DATABASE_URL pnpm --filter @aurum/db exec prisma migrate dev --name init --skip-seed"
    echo   "  pnpm --filter @aurum/db db:seed"
    return 0
  fi

  log "Bringing up infrastructure (Postgres / Redis / Kafka / …)"
  docker compose -f docker-compose.infra.yml up -d
  wait_for_postgres || return 1

  local migdir="packages/db/prisma/migrations"
  if [ -d "$migdir" ] && [ -n "$(ls -A "$migdir" 2>/dev/null)" ]; then
    log "Applying committed migrations (prisma migrate deploy)"
    corepack pnpm --filter @aurum/db db:migrate
  else
    log "No migrations yet — creating the baseline 'init' migration"
    corepack pnpm --filter @aurum/db exec prisma migrate dev --name init --skip-seed
    yellow "IMPORTANT: commit the new packages/db/prisma/migrations/ folder to git.\n"
  fi

  log "Seeding admin user"
  corepack pnpm --filter @aurum/db db:seed

  green "Bootstrap complete. Start the API with:  pnpm --filter @aurum/api dev\n"
}

# ── Main ──────────────────────────────────────────────────────────────────────
require_ubuntu

if [ "$MODE" = "install" ]; then
  install_base
  install_node
  install_pnpm
  install_docker
  configure_docker_logging
  configure_swap
  [ "$DO_FOUNDRY" = "yes" ] && install_foundry
fi

verify_all
print_table

if [ "$DO_PROJECT" = "yes" ] && [ "$FAILS" -eq 0 ]; then
  bootstrap_project
fi

echo
if [ "$FAILS" -eq 0 ]; then
  green "✅ All requirements satisfied.\n"
  exit 0
else
  red "❌ $FAILS requirement(s) failed — see table above.\n"
  exit 1
fi
