#!/usr/bin/env bash
#
# Aurum — Postgres backup (gzip dump + rotation)
# ==============================================================================
# Dumps the Aurum database from the running Postgres container, compresses it,
# verifies the dump is non-empty, and prunes backups older than RETENTION_DAYS.
#
# One-time setup:
#   sudo mkdir -p /var/backups/aurum && sudo chown "$USER" /var/backups/aurum
#   sed -i 's/\r$//' scripts/backup-postgres.sh   # strip CRLF if copied from Windows
#   chmod +x scripts/backup-postgres.sh
#   ./scripts/backup-postgres.sh                  # test it once, confirm a .sql.gz lands
#
# Cron (nightly at 02:30 — `crontab -e`, adjust PROJECT_DIR to your checkout):
#   30 2 * * * PROJECT_DIR=/opt/aurum /opt/aurum/scripts/backup-postgres.sh >> /var/log/aurum-backup.log 2>&1
#
# Restore (DANGER — overwrites the DB):
#   gunzip -c /var/backups/aurum/aurum-YYYYmmdd-HHMMSS.sql.gz \
#     | docker compose -f docker-compose.infra.yml exec -T postgres psql -U aurum -d aurum
# ==============================================================================
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────────────
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.infra.yml}"  # or docker-compose.yml for full stack
PG_SERVICE="${PG_SERVICE:-postgres}"
PG_USER="${PG_USER:-aurum}"
PG_DB="${PG_DB:-aurum}"
PG_PASSWORD="${PG_PASSWORD:-aurum_secret}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/aurum}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

ts="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/aurum-$ts.sql.gz"

echo "[$(date -Is)] dumping $PG_DB from service '$PG_SERVICE' ($COMPOSE_FILE)…"

# --no-owner/--clean make the dump portable + restorable onto a fresh DB.
docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$PG_PASSWORD" "$PG_SERVICE" \
	pg_dump -U "$PG_USER" --no-owner --clean --if-exists "$PG_DB" \
	| gzip > "$out"

# Verify the dump actually contains data (catches a silent failure piping to gzip).
if [ ! -s "$out" ] || [ "$(gzip -dc "$out" | head -c 1 | wc -c)" -eq 0 ]; then
	echo "[$(date -Is)] ERROR: backup is empty — removing and failing." >&2
	rm -f "$out"
	exit 1
fi

size="$(du -h "$out" | cut -f1)"
echo "[$(date -Is)] OK: $out ($size)"

# ── Rotation ──────────────────────────────────────────────────────────────────
deleted="$(find "$BACKUP_DIR" -name 'aurum-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[$(date -Is)] pruned $deleted backup(s) older than ${RETENTION_DAYS}d"
