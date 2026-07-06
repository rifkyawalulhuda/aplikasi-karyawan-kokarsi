# deploy/setup-backup-schedule.ps1
# Daftarkan backup.ps1 ke Windows Task Scheduler
# Jalankan sekali sebagai Administrator
#
# Usage:
#   .\deploy\setup-backup-schedule.ps1                           - Daftar task (jam 02:00 WIB)
#   .\deploy\setup-backup-schedule.ps1 -Remove                   - Hapus task
#   .\deploy\setup-backup-schedule.ps1 -Hour 3                   - Custom jam (misal jam 03:00)
#   .\deploy\setup-backup-schedule.ps1 -BackupDir "D:\Backup"    - Custom folder backup

param(
  [switch]$Remove,
  [int]$Hour = 2,
  [string]$BackupDir = "E:\Backup\kokarsi"
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
  -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`" -BackupDir `"$BackupDir`""

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
  -Description "Backup otomatis database + uploads Kokarsi PT. Sankyu setiap hari jam $($Hour):00" | Out-Null

Write-Host ""
Write-Host "Scheduled task registered successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Task name  : $TaskName"
Write-Host "  Script     : $ScriptPath"
Write-Host "  Schedule   : Every day at $($Hour):00"
Write-Host "  Backup dir : $BackupDir"
Write-Host "  Retention  : 7 days"
Write-Host ""
Write-Host "To run backup now:"
Write-Host "  .\deploy\backup.ps1 -BackupDir `"$BackupDir`""
Write-Host ""
Write-Host "To check task status:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host ""
Write-Host "To remove task:"
Write-Host "  .\deploy\setup-backup-schedule.ps1 -Remove"