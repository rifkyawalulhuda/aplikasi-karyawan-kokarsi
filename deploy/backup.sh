#!/usr/bin/env bash
# deploy/backup.sh
# Backup otomatis database PostgreSQL + folder uploads + config
# Retensi: 7 hari terakhir
#
# Usage:
#   ./deploy/backup.sh                                    - Backup (Docker mode)
#   ./deploy/backup.sh --mode native                     - Backup (PostgreSQL native)
#   ./deploy/backup-dir /home/rifky/backups/kokarsi      - Custom folder
#   ./deploy/backup.sh --mode native --pg-user kokarsi --pg-db kokarsi_karyawan --pg-port 5432

set -euo pipefail

# ── Default values ───────────────────────────────────────────────────────────
MODE="docker"
BACKUP_DIR="$HOME/backups/kokarsi"
PG_USER="kokarsi"
PG_DB="kokarsi_karyawan"
PG_HOST="localhost"
PG_PORT=5432
RETAIN_DAYS=7

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"
BACKUP_NAME="backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
LOG_FILE="$BACKUP_DIR/backup.log"

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode) MODE="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; BACKUP_NAME="backup_$(date +%Y-%m-%d_%H-%M)"; BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"; LOG_FILE="$BACKUP_DIR/backup.log"; shift 2 ;;
    --pg-user) PG_USER="$2"; shift 2 ;;
    --pg-db) PG_DB="$2"; shift 2 ;;
    --pg-host) PG_HOST="$2"; shift 2 ;;
    --pg-port) PG_PORT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--mode docker|native] [--backup-dir DIR] [--pg-user USER] [--pg-db DB] [--pg-host HOST] [--pg-port PORT]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Functions ────────────────────────────────────────────────────────────────
write_log() {
  local level="${2:-INFO}"
  local line="[$(date '+%Y-%m-%d %H:%M:%S') $level] $1"
  echo "$line"
  mkdir -p "$BACKUP_DIR"
  echo "$line" >> "$LOG_FILE"
}

# ── Pastikan folder backup ada ───────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

write_log "===== Backup started: $BACKUP_NAME (Mode: $MODE) ====="
mkdir -p "$BACKUP_PATH"

# ── 1. Backup PostgreSQL ────────────────────────────────────────────────────
write_log "Backing up PostgreSQL database..."

DB_FILE="$BACKUP_PATH/kokarsi_karyawan.sql"

if [[ "$MODE" == "docker" ]]; then
  # Cek apakah container berjalan
  if ! docker ps --format '{{.Names}}' | grep -q '^kokarsi-postgres$'; then
    write_log "Container kokarsi-postgres tidak berjalan! Jalankan: docker compose -f docker-compose.db.yml up -d" "ERROR"
    exit 1
  fi

  # pg_dump — stdout ke file, cek exit code
  if ! docker exec kokarsi-postgres pg_dump -U kokarsi -d kokarsi_karyawan --no-password > "$DB_FILE" 2>/tmp/pg_dump_err.log; then
    write_log "pg_dump FAILED: $(cat /tmp/pg_dump_err.log)" "ERROR"
    rm -f /tmp/pg_dump_err.log
    exit 1
  fi
  rm -f /tmp/pg_dump_err.log
else
  # Parse DATABASE_URL dari backend/.env
  ENV_FILE="$ROOT/backend/.env"
  if [[ -f "$ENV_FILE" ]]; then
    DB_URL=$(grep "^DATABASE_URL" "$ENV_FILE" | head -1 || true)
    if [[ "$DB_URL" =~ postgresql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^"?\s]+) ]]; then
      PG_USER="${BASH_REMATCH[1]}"
      export PGPASSWORD="${BASH_REMATCH[2]}"
      PG_HOST="${BASH_REMATCH[3]}"
      PG_PORT="${BASH_REMATCH[4]}"
      PG_DB="${BASH_REMATCH[5]}"
      write_log "Menggunakan kredensial dari backend/.env (${PG_HOST}:${PG_PORT})"
    else
      write_log "Tidak dapat parse DATABASE_URL dari backend/.env, menggunakan parameter default" "WARN"
      export PGPASSWORD="kokarsi2026"
    fi
  else
    write_log "backend/.env tidak ditemukan, menggunakan parameter default" "WARN"
    export PGPASSWORD="kokarsi2026"
  fi

  if ! command -v pg_dump &> /dev/null; then
    write_log "pg_dump not found in PATH. Install: sudo apt install postgresql-client" "ERROR"
    exit 1
  fi

  # pg_dump — cek exit code
  if ! pg_dump -U "$PG_USER" -d "$PG_DB" -h "$PG_HOST" -p "$PG_PORT" -f "$DB_FILE" 2>/tmp/pg_dump_err.log; then
    write_log "pg_dump FAILED: $(cat /tmp/pg_dump_err.log)" "ERROR"
    rm -f /tmp/pg_dump_err.log
    exit 1
  fi
  rm -f /tmp/pg_dump_err.log
fi

if [[ -f "$DB_FILE" && -s "$DB_FILE" ]]; then
  SIZE_MB=$(du -m "$DB_FILE" | cut -f1)
  write_log "Database backup OK: kokarsi_karyawan.sql (${SIZE_MB} MB)"
else
  write_log "Database backup FAILED" "ERROR"
  exit 1
fi

# ── 2. Backup folder uploads ────────────────────────────────────────────────
write_log "Backing up uploads folder..."

UPLOADS_SRC="$ROOT/backend/uploads"
UPLOADS_DEST="$BACKUP_PATH/uploads"
FILE_COUNT=0

if [[ -d "$UPLOADS_SRC" ]]; then
  cp -r "$UPLOADS_SRC" "$UPLOADS_DEST"
  FILE_COUNT=$(find "$UPLOADS_DEST" -type f | wc -l)
  write_log "Uploads backup OK: $FILE_COUNT file(s) copied"
else
  write_log "Uploads folder not found, skipping: $UPLOADS_SRC" "WARN"
fi

# ── 3. Backup file konfigurasi (.env + cloudflared) ─────────────────────────
write_log "Backing up config files..."

CONFIG_COUNT=0
CONFIG_DEST="$BACKUP_PATH/config"
mkdir -p "$CONFIG_DEST"

# .env files
declare -A ENV_FILES=(
  ["backend.env"]="$ROOT/backend/.env"
  ["root.env"]="$ROOT/.env"
)

for DEST_NAME in "${!ENV_FILES[@]}"; do
  SRC="${ENV_FILES[$DEST_NAME]}"
  if [[ -f "$SRC" ]]; then
    cp "$SRC" "$CONFIG_DEST/$DEST_NAME"
    write_log "Config backup OK: $DEST_NAME"
    ((CONFIG_COUNT++))
  else
    write_log "Config file not found, skipping: $SRC" "WARN"
  fi
done

# Cloudflare Tunnel config
CLOUDFLARED_CONFIG="$HOME/.cloudflared/config.yml"
if [[ -f "$CLOUDFLARED_CONFIG" ]]; then
  cp "$CLOUDFLARED_CONFIG" "$CONFIG_DEST/cloudflared-config.yml"
  write_log "Cloudflared config backup OK"
  ((CONFIG_COUNT++))
else
  write_log "Cloudflared config not found, skipping: $CLOUDFLARED_CONFIG" "WARN"
fi

write_log "Config backup complete: $CONFIG_COUNT file(s) copied"

# ── 4. Tulis metadata backup ────────────────────────────────────────────────
HOSTNAME=$(hostname)
cat > "$BACKUP_PATH/backup-info.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "hostname": "$HOSTNAME",
  "mode": "$MODE",
  "dbName": "$PG_DB",
  "dbSize": "${SIZE_MB} MB",
  "fileCount": $FILE_COUNT,
  "configCount": $CONFIG_COUNT
}
EOF

# ── 5. Hapus backup lama (retensi 7 hari) ───────────────────────────────────
write_log "Cleaning up backups older than $RETAIN_DAYS days..."

DELETED=0
for DIR in "$BACKUP_DIR"/backup_*; do
  [[ -d "$DIR" ]] || continue
  DIR_NAME=$(basename "$DIR")
  # Extract date from backup name: backup_YYYY-MM-DD_HH-MM
  if [[ "$DIR_NAME" =~ ^backup_([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    BACKUP_DATE="${BASH_REMATCH[1]}"
    BACKUP_EPOCH=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo 0)
    CUTOFF_EPOCH=$(date -d "-${RETAIN_DAYS} days" +%s 2>/dev/null || echo 0)
    if [[ "$BACKUP_EPOCH" -gt 0 && "$CUTOFF_EPOCH" -gt 0 && "$BACKUP_EPOCH" -lt "$CUTOFF_EPOCH" ]]; then
      rm -rf "$DIR"
      write_log "Deleted old backup: $DIR_NAME"
      ((DELETED++))
    fi
  fi
done
write_log "Deleted $DELETED old backup(s)"

# ── 6. Summary ──────────────────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | wc -l)
write_log "===== Backup completed: $BACKUP_PATH ====="
write_log "Total backups retained: $TOTAL_BACKUPS"
echo ""
echo "Backup selesai: $BACKUP_PATH"
