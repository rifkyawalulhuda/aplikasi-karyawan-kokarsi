# deploy/setup-backup-schedule.ps1
# Daftarkan backup.ps1 ke Windows Task Scheduler
# Jalankan sekali sebagai Administrator
#
# Usage:
#   .\deploy\setup-backup-schedule.ps1                                     - Daftar task Docker (jam 02:00 WIB)
#   .\deploy\setup-backup-schedule.ps1 -Mode native                        - Daftar task Native PostgreSQL
#   .\deploy\setup-backup-schedule.ps1 -Remove                             - Hapus task
#   .\deploy\setup-backup-schedule.ps1 -Mode native -Hour 3                - Custom jam (misal jam 03:00)
#   .\deploy\setup-backup-schedule.ps1 -Mode native -BackupDir "C:\Backup" - Custom folder backup

param(
  [switch]$Remove,
  [int]$Hour = 2,
  [string]$BackupDir = "E:\Backup\kokarsi",
  [ValidateSet("docker", "native")]
  [string]$Mode = "docker"
)

$TaskName   = "KokarsiDatabaseBackup"
$ScriptPath = Join-Path $PSScriptRoot "backup.ps1"

# ── Remove mode ───────────────────────────────────────────────────────────────
if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Scheduled task '$TaskName' removed." -ForegroundColor Green
  } else {
    Write-Host "Task '$TaskName' not found." -ForegroundColor Yellow
  }
  exit 0
}

# ── Pastikan dijalankan sebagai Administrator ─────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host ""
  Write-Host "ERROR: Script ini harus dijalankan sebagai Administrator!" -ForegroundColor Red
  Write-Host ""
  Write-Host "Caranya:" -ForegroundColor Yellow
  Write-Host "  1. Klik kanan pada file SETUP-BACKUP-SCHEDULE-NATIVE.bat"
  Write-Host "  2. Pilih 'Run as administrator'"
  Write-Host ""
  exit 1
}

# ── Pastikan script backup ada ────────────────────────────────────────────────
if (-not (Test-Path $ScriptPath)) {
  Write-Host "ERROR: backup.ps1 not found at $ScriptPath" -ForegroundColor Red
  exit 1
}

# ── Pastikan folder backup ada ────────────────────────────────────────────────
if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  Write-Host "Created backup directory: $BackupDir"
}

# ── Buat Scheduled Task ───────────────────────────────────────────────────────
# Sertakan -BackupDir agar backup.ps1 tahu folder tujuan
$action  = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`" -Mode `"$Mode`" -BackupDir `"$BackupDir`""

$trigger = New-ScheduledTaskTrigger -Daily -At "$($Hour):00"

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Highest

# Hapus task lama jika ada
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed existing task."
}

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Backup otomatis database + uploads Kokarsi PT. Sankyu setiap hari jam $($Hour):00 (Mode: $Mode)" | Out-Null

Write-Host ""
Write-Host "Scheduled task registered successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Task name  : $TaskName"
Write-Host "  Script     : $ScriptPath"
Write-Host "  Mode       : $Mode"
Write-Host "  Schedule   : Every day at $($Hour):00"
Write-Host "  Backup dir : $BackupDir"
Write-Host "  Retention  : 7 days"
Write-Host ""
Write-Host "To run backup now:"
Write-Host "  .\deploy\backup.ps1 -Mode `"$Mode`" -BackupDir `"$BackupDir`""
Write-Host ""
Write-Host "To check task status:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host ""
Write-Host "To remove task:"
Write-Host "  .\deploy\setup-backup-schedule.ps1 -Remove"