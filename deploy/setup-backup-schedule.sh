#!/usr/bin/env bash
# deploy/setup-backup-schedule.sh
# Daftarkan backup.sh ke crontab agar jalan otomatis
#
# Usage:
#   ./deploy/setup-backup-schedule.sh                          - Setup cron (jam 02:00)
#   ./deploy/setup-backup-schedule.sh --hour 3                 - Custom jam
#   ./deploy/setup-backup-schedule.sh --backup-dir /custom/dir - Custom folder
#   ./deploy/setup-backup-schedule.sh --mode native            - PostgreSQL native
#   ./deploy/setup-backup-schedule.sh --remove                 - Hapus cron

set -euo pipefail

# ── Default values ───────────────────────────────────────────────────────────
REMOVE=false
HOUR=2
MINUTE=0
MODE="docker"
BACKUP_DIR="$HOME/backups/kokarsi"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
CRON_TAG="# kokarsi-backup"

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --remove) REMOVE=true; shift ;;
    --hour) HOUR="$2"; shift 2 ;;
    --minute) MINUTE="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--remove] [--hour HOUR] [--minute MINUTE] [--mode docker|native] [--backup-dir DIR]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Remove mode ──────────────────────────────────────────────────────────────
if [[ "$REMOVE" == true ]]; then
  if crontab -l 2>/dev/null | grep -q "$CRON_TAG"; then
    crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab -
    echo "Cron job kokarsi-backup removed."
  else
    echo "Cron job kokarsi-backup not found."
  fi
  exit 0
fi

# ── Pastikan script backup ada ───────────────────────────────────────────────
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "ERROR: backup.sh not found at $BACKUP_SCRIPT"
  exit 1
fi

# ── Pastikan executable ──────────────────────────────────────────────────────
chmod +x "$BACKUP_SCRIPT"

# ── Pastikan folder backup ada ───────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Hapus cron lama jika ada ─────────────────────────────────────────────────
crontab -l 2>/dev/null | grep -v "$CRON_TAG" > /tmp/crontab_tmp || true

# ── Tambah cron baru ─────────────────────────────────────────────────────────
CRON_LINE="$MINUTE $HOUR * * * $BACKUP_SCRIPT --mode $MODE --backup-dir $BACKUP_DIR >> $BACKUP_DIR/cron.log 2>&1 $CRON_TAG"
echo "$CRON_LINE" >> /tmp/crontab_tmp
crontab /tmp/crontab_tmp
rm -f /tmp/crontab_tmp

echo ""
echo "Cron job registered successfully!"
echo ""
echo "  Script     : $BACKUP_SCRIPT"
echo "  Mode       : $MODE"
echo "  Schedule   : Every day at $(printf '%02d:%02d' $HOUR $MINUTE)"
echo "  Backup dir : $BACKUP_DIR"
echo "  Retention  : 7 days"
echo "  Log        : $BACKUP_DIR/cron.log"
echo ""
echo "To run backup now:"
echo "  $BACKUP_SCRIPT --mode $MODE --backup-dir $BACKUP_DIR"
echo ""
echo "To check cron status:"
echo "  crontab -l"
echo ""
echo "To remove cron:"
echo "  $0 --remove"
