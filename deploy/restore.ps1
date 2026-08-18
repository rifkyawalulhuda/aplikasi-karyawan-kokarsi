# deploy/restore.ps1
# Restore database PostgreSQL + uploads dari folder backup
#
# Usage:
#   .\deploy\restore.ps1                              - Pilih backup (Docker mode)
#   .\deploy\restore.ps1 -Mode native                 - Restore (PostgreSQL native)
#   .\deploy\restore.ps1 -BackupName "backup_2026-07-06_15-51"  - Pilih backup tertentu
#   .\deploy\restore.ps1 -BackupDir "D:\Backup\kokarsi"         - Custom folder backup
#   .\deploy\restore.ps1 -ListOnly                    - Tampilkan daftar backup tersedia

param(
  [string]$BackupDir  = "E:\Backup\kokarsi",
  [string]$BackupName = "",
  [switch]$ListOnly,
  [ValidateSet("docker", "native")]
  [string]$Mode       = "docker",
  [string]$PgUser     = "kokarsi",
  [string]$PgDb       = "kokarsi_karyawan",
  [string]$PgHost     = "localhost",
  [int]$PgPort        = 5432
)

$Root    = Split-Path $PSScriptRoot -Parent
$LogFile = Join-Path $BackupDir "restore.log"

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "[$((Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) $Level] $Message"
  Write-Host $line
  if (Test-Path $BackupDir) {
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
  }
}

# ── Cek folder backup ada ─────────────────────────────────────────────────────
if (-not (Test-Path $BackupDir)) {
  Write-Host "ERROR: Backup directory not found: $BackupDir" -ForegroundColor Red
  exit 1
}

# ── Daftar semua backup ───────────────────────────────────────────────────────
$backups = Get-ChildItem -LiteralPath $BackupDir -Directory |
  Where-Object { $_.Name -match "^backup_\d{4}-\d{2}-\d{2}" } |
  Sort-Object CreationTime -Descending

if ($backups.Count -eq 0) {
  Write-Host "ERROR: No backups found in $BackupDir" -ForegroundColor Red
  exit 1
}

# ── List mode ─────────────────────────────────────────────────────────────────
if ($ListOnly) {
  Write-Host ""
  Write-Host "Available backups in $BackupDir" -ForegroundColor Cyan
  Write-Host ""
  $i = 1
  foreach ($b in $backups) {
    $info = Join-Path $b.FullName "backup-info.json"
    $dbSize = "-"; $fileCount = "-"; $backupMode = "-"
    if (Test-Path $info) {
      $meta = Get-Content $info | ConvertFrom-Json
      $dbSize = $meta.dbSize
      $fileCount = $meta.fileCount
      $backupMode = $meta.mode
    }
    $latest = if ($i -eq 1) { " (latest)" } else { "" }
    Write-Host "  [$i] $($b.Name)$latest — DB: $dbSize, Files: $fileCount, Mode: $backupMode" -ForegroundColor $(if ($i -eq 1) { 'Green' } else { 'White' })
    $i++
  }
  Write-Host ""
  exit 0
}

# ── Pilih backup ──────────────────────────────────────────────────────────────
if ($BackupName -eq "") {
  Write-Host ""
  Write-Host "Available backups:" -ForegroundColor Cyan
  $i = 1
  foreach ($b in $backups) {
    $info = Join-Path $b.FullName "backup-info.json"
    $dbSize = "-"; $fileCount = "-"; $backupMode = "-"
    if (Test-Path $info) {
      $meta = Get-Content $info | ConvertFrom-Json
      $dbSize = $meta.dbSize
      $fileCount = $meta.fileCount
      $backupMode = $meta.mode
    }
    $latest = if ($i -eq 1) { " (latest)" } else { "" }
    Write-Host "  [$i] $($b.Name)$latest — DB: $dbSize, Files: $fileCount, Mode: $backupMode"
    $i++
  }
  Write-Host ""
  $choice = Read-Host "Pilih nomor backup (default: 1 = latest)"
  if ($choice -eq "") { $choice = "1" }
  $idx = [int]$choice - 1
  if ($idx -lt 0 -or $idx -ge $backups.Count) {
    Write-Host "ERROR: Invalid choice." -ForegroundColor Red
    exit 1
  }
  $BackupName = $backups[$idx].Name
}

$BackupPath = Join-Path $BackupDir $BackupName

if (-not (Test-Path $BackupPath)) {
  Write-Host "ERROR: Backup not found: $BackupPath" -ForegroundColor Red
  exit 1
}

# ── Konfirmasi restore ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "WARNING: Restore akan menimpa data database dan uploads saat ini!" -ForegroundColor Yellow
Write-Host "Backup   : $BackupName" -ForegroundColor Cyan
Write-Host "Mode     : $Mode" -ForegroundColor Cyan
if ($Mode -eq "native") {
  Write-Host "DB       : $PgUser@$PgHost`:$PgPort/$PgDb" -ForegroundColor Cyan
}
Write-Host ""
$confirm = Read-Host "Ketik 'YES' untuk melanjutkan"
if ($confirm -ne "YES") {
  Write-Host "Restore dibatalkan." -ForegroundColor Yellow
  exit 0
}

Write-Log "===== Restore started: $BackupName (Mode: $Mode) ====="

# ── 1. Restore Database ───────────────────────────────────────────────────────
$DbFile = Join-Path $BackupPath "kokarsi_karyawan.sql"

if (Test-Path $DbFile) {
  Write-Log "Restoring PostgreSQL database..."

  if ($Mode -eq "docker") {
    # Drop dan recreate database via Docker
    docker exec kokarsi-postgres psql -U kokarsi -d postgres -c "DROP DATABASE IF EXISTS kokarsi_karyawan;" 2>&1 | Out-Null
    docker exec kokarsi-postgres psql -U kokarsi -d postgres -c "CREATE DATABASE kokarsi_karyawan;" 2>&1 | Out-Null
    Get-Content $DbFile | docker exec -i kokarsi-postgres psql -U kokarsi -d kokarsi_karyawan 2>&1 | Out-Null
  } else {
    # Cek psql tersedia
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlCmd) {
      Write-Log "psql not found in PATH. Pastikan PostgreSQL bin directory ada di PATH." "ERROR"
      Write-Log "Contoh: C:\Program Files\PostgreSQL\16\bin" "ERROR"
      exit 1
    }
    # Drop dan recreate database native
    & psql -U $PgUser -h $PgHost -p $PgPort -d postgres -c "DROP DATABASE IF EXISTS $PgDb;" 2>&1 | Out-Null
    & psql -U $PgUser -h $PgHost -p $PgPort -d postgres -c "CREATE DATABASE $PgDb;" 2>&1 | Out-Null
    & psql -U $PgUser -h $PgHost -p $PgPort -d $PgDb -f $DbFile 2>&1 | Out-Null
  }

  if ($LASTEXITCODE -eq 0) {
    Write-Log "Database restore OK: $PgDb"
  } else {
    Write-Log "Database restore FAILED" "ERROR"
    exit 1
  }
} else {
  Write-Log "Database backup file not found, skipping: $DbFile" "WARN"
}

# ── 2. Restore Uploads ────────────────────────────────────────────────────────
$UploadsSrc  = Join-Path $BackupPath "uploads"
$UploadsDest = Join-Path $Root "backend\uploads"

if (Test-Path $UploadsSrc) {
  Write-Log "Restoring uploads folder..."

  # Backup uploads lama sebelum ditimpa
  if (Test-Path $UploadsDest) {
    $oldUploadsBackup = "${UploadsDest}_old_$(Get-Date -Format 'yyyyMMdd_HHmm')"
    Rename-Item -Path $UploadsDest -NewName $oldUploadsBackup -Force
    Write-Log "Old uploads saved as: $(Split-Path $oldUploadsBackup -Leaf)"
  }

  Copy-Item -Path $UploadsSrc -Destination $UploadsDest -Recurse -Force
  $fileCount = (Get-ChildItem $UploadsDest -Recurse -File).Count
  Write-Log "Uploads restore OK: $fileCount file(s) restored"
} else {
  Write-Log "Uploads backup not found, skipping: $UploadsSrc" "WARN"
}

# ── 3. Restore Config Files (.env + cloudflared) ─────────────────────────────
$ConfigSrc = Join-Path $BackupPath "config"

if (Test-Path $ConfigSrc) {
  Write-Log "Restoring config files..."

  # .env files
  $envRestoreMap = @(
    @{ src = (Join-Path $ConfigSrc "backend.env"); dest = (Join-Path $Root "backend\.env"); label = "backend\.env" },
    @{ src = (Join-Path $ConfigSrc "root.env");    dest = (Join-Path $Root ".env");         label = ".env (root)"  }
  )
  foreach ($f in $envRestoreMap) {
    if (Test-Path $f.src) {
      if (Test-Path $f.dest) {
        # .env sudah ada — tanya konfirmasi sebelum timpa
        $overwrite = Read-Host "$($f.label) sudah ada. Timpa? (y/N)"
        if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
          Write-Log "Skipped: $($f.label) (tidak ditimpa)"
          continue
        }
      }
      Copy-Item $f.src -Destination $f.dest -Force
      Write-Log "Config restore OK: $($f.label)"
    } else {
      Write-Log "Config backup not found, skipping: $($f.src)" "WARN"
    }
  }

  # Cloudflare Tunnel config
  $cloudflaredSrc  = Join-Path $ConfigSrc "cloudflared-config.yml"
  $cloudflaredDest = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
  if (Test-Path $cloudflaredSrc) {
    if (Test-Path $cloudflaredDest) {
      $overwrite = Read-Host "~\.cloudflared\config.yml sudah ada. Timpa? (y/N)"
      if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
        Write-Log "Skipped: cloudflared config (tidak ditimpa)"
      } else {
        Copy-Item $cloudflaredSrc -Destination $cloudflaredDest -Force
        Write-Log "Cloudflared config restore OK"
      }
    } else {
      New-Item -ItemType Directory -Path (Split-Path $cloudflaredDest -Parent) -Force | Out-Null
      Copy-Item $cloudflaredSrc -Destination $cloudflaredDest -Force
      Write-Log "Cloudflared config restore OK"
    }
  } else {
    Write-Log "Cloudflared config backup not found, skipping" "WARN"
  }
} else {
  Write-Log "Config backup folder not found, skipping: $ConfigSrc" "WARN"
}

Write-Log "===== Restore completed from: $BackupName ====="
Write-Host ""
Write-Host "Restore selesai! Restart backend agar perubahan ter-load." -ForegroundColor Green