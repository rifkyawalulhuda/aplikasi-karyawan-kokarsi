#!/usr/bin/env bash
# deploy/restore.sh
# Restore database PostgreSQL + uploads + config dari folder backup
#
# Usage:
#   ./deploy/restore.sh                                  - Interaktif (pilih backup)
#   ./deploy/restore.sh --list                           - Tampilkan daftar backup
#   ./deploy/restore.sh --backup-name backup_2026-08-29_02-00  - Restore tertentu
#   ./deploy/restore.sh --backup-dir /home/rifky/backups/kokarsi
#   ./deploy/restore.sh --mode native                    - Restore PostgreSQL native

set -euo pipefail

# ── Default values ───────────────────────────────────────────────────────────
MODE="docker"
BACKUP_DIR="$HOME/backups/kokarsi"
BACKUP_NAME=""
LIST_ONLY=false
PG_USER="kokarsi"
PG_DB="kokarsi_karyawan"
PG_HOST="localhost"
PG_PORT=5432

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$BACKUP_DIR/restore.log"

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode) MODE="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; LOG_FILE="$BACKUP_DIR/restore.log"; shift 2 ;;
    --backup-name) BACKUP_NAME="$2"; shift 2 ;;
    --list) LIST_ONLY=true; shift ;;
    --pg-user) PG_USER="$2"; shift 2 ;;
    --pg-db) PG_DB="$2"; shift 2 ;;
    --pg-host) PG_HOST="$2"; shift 2 ;;
    --pg-port) PG_PORT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--list] [--backup-name NAME] [--mode docker|native] [--backup-dir DIR]"
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

# ── Cek folder backup ada ────────────────────────────────────────────────────
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: Backup directory not found: $BACKUP_DIR"
  exit 1
fi

# ── Daftar semua backup ──────────────────────────────────────────────────────
mapfile -t BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r)

if [[ ${#BACKUPS[@]} -eq 0 ]]; then
  echo "ERROR: No backups found in $BACKUP_DIR"
  exit 1
fi

# ── List mode ────────────────────────────────────────────────────────────────
if [[ "$LIST_ONLY" == true ]]; then
  echo ""
  echo "Available backups in $BACKUP_DIR"
  echo ""
  IDX=1
  for B in "${BACKUPS[@]}"; do
    B_NAME=$(basename "$B")
    INFO_FILE="$B/backup-info.json"
    DB_SIZE="-"; FILE_COUNT="-"; BACKUP_MODE="-"
    if [[ -f "$INFO_FILE" ]]; then
      DB_SIZE=$(grep -o '"dbSize": *"[^"]*"' "$INFO_FILE" | cut -d'"' -f4 || echo "-")
      FILE_COUNT=$(grep -o '"fileCount": *[0-9]*' "$INFO_FILE" | awk '{print $2}' || echo "-")
      BACKUP_MODE=$(grep -o '"mode": *"[^"]*"' "$INFO_FILE" | cut -d'"' -f4 || echo "-")
    fi
    LATEST=""
    if [[ $IDX -eq 1 ]]; then
      LATEST=" (latest)"
      echo "  [$IDX] $B_NAME$LATEST — DB: $DB_SIZE, Files: $FILE_COUNT, Mode: $BACKUP_MODE"
    else
      echo "  [$IDX] $B_NAME — DB: $DB_SIZE, Files: $FILE_COUNT, Mode: $BACKUP_MODE"
    fi
    ((IDX++))
  done
  echo ""
  exit 0
fi

# ── Pilih backup ─────────────────────────────────────────────────────────────
if [[ -z "$BACKUP_NAME" ]]; then
  echo ""
  echo "Available backups:"
  IDX=1
  for B in "${BACKUPS[@]}"; do
    B_NAME=$(basename "$B")
    INFO_FILE="$B/backup-info.json"
    DB_SIZE="-"; FILE_COUNT="-"; BACKUP_MODE="-"
    if [[ -f "$INFO_FILE" ]]; then
      DB_SIZE=$(grep -o '"dbSize": *"[^"]*"' "$INFO_FILE" | cut -d'"' -f4 || echo "-")
      FILE_COUNT=$(grep -o '"fileCount": *[0-9]*' "$INFO_FILE" | awk '{print $2}' || echo "-")
      BACKUP_MODE=$(grep -o '"mode": *"[^"]*"' "$INFO_FILE" | cut -d'"' -f4 || echo "-")
    fi
    LATEST=""
    if [[ $IDX -eq 1 ]]; then LATEST=" (latest)"; fi
    echo "  [$IDX] $B_NAME$LATEST — DB: $DB_SIZE, Files: $FILE_COUNT, Mode: $BACKUP_MODE"
    ((IDX++))
  done
  echo ""
  read -rp "Pilih nomor backup (default: 1 = latest): " CHOICE
  CHOICE="${CHOICE:-1}"
  IDX=$((CHOICE - 1))
  if [[ $IDX -lt 0 || $IDX -ge ${#BACKUPS[@]} ]]; then
    echo "ERROR: Invalid choice."
    exit 1
  fi
  BACKUP_NAME=$(basename "${BACKUPS[$IDX]}")
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

if [[ ! -d "$BACKUP_PATH" ]]; then
  echo "ERROR: Backup not found: $BACKUP_PATH"
  exit 1
fi

# ── Konfirmasi restore ───────────────────────────────────────────────────────
echo ""
echo "WARNING: Restore akan menimpa data database dan uploads saat ini!"
echo "Backup   : $BACKUP_NAME"
echo "Mode     : $MODE"
if [[ "$MODE" == "native" ]]; then
  echo "DB       : ${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"
fi
echo ""
read -rp "Ketik 'YES' untuk melanjutkan: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Restore dibatalkan."
  exit 0
fi

write_log "===== Restore started: $BACKUP_NAME (Mode: $MODE) ====="

# ── 1. Restore Database ──────────────────────────────────────────────────────
DB_FILE="$BACKUP_PATH/kokarsi_karyawan.sql"

if [[ -f "$DB_FILE" ]]; then
  write_log "Restoring PostgreSQL database..."

  if [[ "$MODE" == "docker" ]]; then
    docker exec kokarsi-postgres psql -U kokarsi -d postgres -c "DROP DATABASE IF EXISTS kokarsi_karyawan;" 2>&1 || true
    docker exec kokarsi-postgres psql -U kokarsi -d postgres -c "CREATE DATABASE kokarsi_karyawan;" 2>&1 || true
    cat "$DB_FILE" | docker exec -i kokarsi-postgres psql -U kokarsi -d kokarsi_karyawan 2>&1 || true
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

    if ! command -v psql &> /dev/null; then
      write_log "psql not found in PATH. Install: sudo apt install postgresql-client" "ERROR"
      exit 1
    fi

    psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d postgres -c "DROP DATABASE IF EXISTS $PG_DB;" 2>&1 || true
    psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d postgres -c "CREATE DATABASE $PG_DB;" 2>&1 || true
    psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d "$PG_DB" -f "$DB_FILE" 2>&1 || true
  fi

  write_log "Database restore OK: $PG_DB"
else
  write_log "Database backup file not found, skipping: $DB_FILE" "WARN"
fi

# ── 2. Restore Uploads ───────────────────────────────────────────────────────
UPLOADS_SRC="$BACKUP_PATH/uploads"
UPLOADS_DEST="$ROOT/backend/uploads"

if [[ -d "$UPLOADS_SRC" ]]; then
  write_log "Restoring uploads folder..."

  # Backup uploads lama sebelum ditimpa
  if [[ -d "$UPLOADS_DEST" ]]; then
    OLD_UPLOADS="${UPLOADS_DEST}_old_$(date +%Y%m%d_%H%M)"
    mv "$UPLOADS_DEST" "$OLD_UPLOADS"
    write_log "Old uploads saved as: $(basename "$OLD_UPLOADS")"
  fi

  cp -r "$UPLOADS_SRC" "$UPLOADS_DEST"
  FILE_COUNT=$(find "$UPLOADS_DEST" -type f | wc -l)
  write_log "Uploads restore OK: $FILE_COUNT file(s) restored"
else
  write_log "Uploads backup not found, skipping: $UPLOADS_SRC" "WARN"
fi

# ── 3. Restore Config Files (.env + cloudflared) ────────────────────────────
CONFIG_SRC="$BACKUP_PATH/config"

if [[ -d "$CONFIG_SRC" ]]; then
  write_log "Restoring config files..."

  # .env files
  declare -a ENV_RESTORE=(
    "backend.env:$ROOT/backend/.env:backend/.env"
    "root.env:$ROOT/.env:.env (root)"
  )

  for ENTRY in "${ENV_RESTORE[@]}"; do
    IFS=':' read -r SRC DEST LABEL <<< "$ENTRY"
    SRC_PATH="$CONFIG_SRC/$SRC"
    if [[ -f "$SRC_PATH" ]]; then
      if [[ -f "$DEST" ]]; then
        read -rp "$LABEL sudah ada. Timpa? (y/N): " OVERWRITE
        if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
          write_log "Skipped: $LABEL (tidak ditimpa)"
          continue
        fi
      fi
      cp "$SRC_PATH" "$DEST"
      write_log "Config restore OK: $LABEL"
    else
      write_log "Config backup not found, skipping: $SRC_PATH" "WARN"
    fi
  done

  # Cloudflare Tunnel config
  CLOUDFLARED_SRC="$CONFIG_SRC/cloudflared-config.yml"
  CLOUDFLARED_DEST="$HOME/.cloudflared/config.yml"
  if [[ -f "$CLOUDFLARED_SRC" ]]; then
    if [[ -f "$CLOUDFLARED_DEST" ]]; then
      read -rp "~/.cloudflared/config.yml sudah ada. Timpa? (y/N): " OVERWRITE
      if [[ "$OVERWRITE" == "y" || "$OVERWRITE" == "Y" ]]; then
        cp "$CLOUDFLARED_SRC" "$CLOUDFLARED_DEST"
        write_log "Cloudflared config restore OK"
      else
        write_log "Skipped: cloudflared config (tidak ditimpa)"
      fi
    else
      mkdir -p "$HOME/.cloudflared"
      cp "$CLOUDFLARED_SRC" "$CLOUDFLARED_DEST"
      write_log "Cloudflared config restore OK"
    fi
  else
    write_log "Cloudflared config backup not found, skipping" "WARN"
  fi
else
  write_log "Config backup folder not found, skipping: $CONFIG_SRC" "WARN"
fi

write_log "===== Restore completed from: $BACKUP_NAME ====="
echo ""
echo "Restore selesai! Restart backend agar perubahan ter-load."
