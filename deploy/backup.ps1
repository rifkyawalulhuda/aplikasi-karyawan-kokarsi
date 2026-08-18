# deploy/backup.ps1
# Backup otomatis database PostgreSQL + folder uploads
# Retensi: 7 hari terakhir
#
# Usage:
#   .\deploy\backup.ps1                          - Backup (Docker mode)
#   .\deploy\backup.ps1 -Mode native             - Backup (PostgreSQL native)
#   .\deploy\backup.ps1 -BackupDir "D:\Backup"   - Custom folder
#   .\deploy\backup.ps1 -Mode native -PgUser kokarsi -PgDb kokarsi_karyawan -PgPort 5432

param(
  [string]$BackupDir = "E:\Backup\kokarsi",
  [ValidateSet("docker", "native")]
  [string]$Mode      = "docker",
  [string]$PgUser    = "kokarsi",
  [string]$PgDb      = "kokarsi_karyawan",
  [string]$PgHost    = "localhost",
  [int]$PgPort       = 5432
)

$Root        = Split-Path $PSScriptRoot -Parent
$Timestamp   = Get-Date -Format "yyyy-MM-dd_HH-mm"
$BackupName  = "backup_$Timestamp"
$BackupPath  = Join-Path $BackupDir $BackupName
$LogFile     = Join-Path $BackupDir "backup.log"
$RetainDays  = 7

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "[$((Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) $Level] $Message"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# Pastikan folder backup ada
if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Log "===== Backup started: $BackupName (Mode: $Mode) ====="
New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

# ── 1. Backup PostgreSQL ─────────────────────────────────────────────────────
Write-Log "Backing up PostgreSQL database..."

$DbFile = Join-Path $BackupPath "kokarsi_karyawan.sql"

if ($Mode -eq "docker") {
  # pg_dump via Docker
  docker exec kokarsi-postgres pg_dump -U kokarsi -d kokarsi_karyawan --no-password 2>&1 | Out-File -FilePath $DbFile -Encoding UTF8
} else {
  # pg_dump native — pastikan pg_dump ada di PATH
  $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
  if (-not $pgDump) {
    Write-Log "pg_dump not found in PATH. Pastikan PostgreSQL bin directory ada di PATH." "ERROR"
    Write-Log "Contoh: C:\Program Files\PostgreSQL\16\bin" "ERROR"
    exit 1
  }
  $env:PGPASSWORD = ""  # Kosongkan, gunakan pg_hba.conf atau .pgpass
  & pg_dump -U $PgUser -d $PgDb -h $PgHost -p $PgPort --no-password -f $DbFile 2>&1
}

if ($LASTEXITCODE -eq 0 -and (Test-Path $DbFile) -and (Get-Item $DbFile).Length -gt 0) {
  $sizeMB = [math]::Round((Get-Item $DbFile).Length / 1MB, 2)
  Write-Log "Database backup OK: kokarsi_karyawan.sql ($sizeMB MB)"
} else {
  Write-Log "Database backup FAILED" "ERROR"
  exit 1
}

# ── 2. Backup folder uploads ─────────────────────────────────────────────────
Write-Log "Backing up uploads folder..."

$UploadsSource = Join-Path $Root "backend\uploads"
$UploadsDest   = Join-Path $BackupPath "uploads"
$fileCount     = 0

if (Test-Path $UploadsSource) {
  Copy-Item -Path $UploadsSource -Destination $UploadsDest -Recurse -Force
  $fileCount = (Get-ChildItem $UploadsDest -Recurse -File).Count
  Write-Log "Uploads backup OK: $fileCount file(s) copied"
} else {
  Write-Log "Uploads folder not found, skipping: $UploadsSource" "WARN"
}

# ── 3. Backup file konfigurasi (.env + cloudflared) ──────────────────────────
Write-Log "Backing up config files..."

$configCount = 0
$ConfigDest  = Join-Path $BackupPath "config"
New-Item -ItemType Directory -Path $ConfigDest -Force | Out-Null

# .env files
$envFiles = @(
  @{ src = (Join-Path $Root "backend\.env"); dest = "backend.env" },
  @{ src = (Join-Path $Root ".env");         dest = "root.env"    }
)
foreach ($f in $envFiles) {
  if (Test-Path $f.src) {
    Copy-Item $f.src -Destination (Join-Path $ConfigDest $f.dest) -Force
    Write-Log "Config backup OK: $($f.dest)"
    $configCount++
  } else {
    Write-Log "Config file not found, skipping: $($f.src)" "WARN"
  }
}

# Cloudflare Tunnel config
$cloudflaredConfig = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (Test-Path $cloudflaredConfig) {
  Copy-Item $cloudflaredConfig -Destination (Join-Path $ConfigDest "cloudflared-config.yml") -Force
  Write-Log "Cloudflared config backup OK"
  $configCount++
} else {
  Write-Log "Cloudflared config not found, skipping: $cloudflaredConfig" "WARN"
}

Write-Log "Config backup complete: $configCount file(s) copied"

# ── 4. Tulis metadata backup ──────────────────────────────────────────────────
$meta = @{
  timestamp   = $Timestamp
  hostname    = $env:COMPUTERNAME
  mode        = $Mode
  dbName      = $PgDb
  dbSize      = "$sizeMB MB"
  fileCount   = $fileCount
  configCount = $configCount
} | ConvertTo-Json
$meta | Out-File -FilePath (Join-Path $BackupPath "backup-info.json") -Encoding UTF8

# ── 4. Hapus backup lama (retensi 7 hari) ────────────────────────────────────
Write-Log "Cleaning up backups older than $RetainDays days..."
$cutoff = (Get-Date).AddDays(-$RetainDays)
$old = Get-ChildItem -LiteralPath $BackupDir -Directory | Where-Object {
  $_.Name -match "^backup_\d{4}-\d{2}-\d{2}" -and $_.CreationTime -lt $cutoff
}
foreach ($dir in $old) {
  Remove-Item -LiteralPath $dir.FullName -Recurse -Force
  Write-Log "Deleted old backup: $($dir.Name)"
}

Write-Log "===== Backup completed: $BackupPath ====="
Write-Log "Total backups retained: $((Get-ChildItem -LiteralPath $BackupDir -Directory | Where-Object { $_.Name -match '^backup_' }).Count)"