# deploy/start.ps1
# Startup/stop script for Kokarsi PT. Sankyu production services
#
# Usage:
#   .\deploy\start.ps1                  - Start semua service (Docker mode)
#   .\deploy\start.ps1 -Mode native     - Start semua service (PostgreSQL native)
#   .\deploy\start.ps1 -Stop            - Stop semua service

param(
  [switch]$Stop,
  [ValidateSet("docker", "native")]
  [string]$Mode = "docker"
)

$Root    = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"

# ── Stop mode ────────────────────────────────────────────────────────────────
if ($Stop) {
  Write-Host "Stopping all services..." -ForegroundColor Yellow

  # Stop cloudflared tunnel
  Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
  Write-Host "  [ok] cloudflared stopped"

  # Stop frontend (node .output/server/index.mjs)
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "\.output"
  } | Stop-Process -Force -ErrorAction SilentlyContinue

  # Stop backend node process
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "dist[/\\]main"
  } | Stop-Process -Force -ErrorAction SilentlyContinue

  Write-Host "  [ok] node processes stopped"

  # Stop Docker PostgreSQL (hanya jika mode docker)
  if ($Mode -eq "docker") {
    docker compose -f (Join-Path $Root "docker-compose.db.yml") down
    Write-Host "  [ok] PostgreSQL container stopped"
  } else {
    Write-Host "  [skip] PostgreSQL native - stop manually jika diperlukan"
  }

  Write-Host ""
  Write-Host "All services stopped." -ForegroundColor Green
  exit 0
}

# ── Start mode ───────────────────────────────────────────────────────────────
Write-Host "Starting Kokarsi PT. Sankyu services (Mode: $Mode)..." -ForegroundColor Cyan
Write-Host ""

# 1. Database
if ($Mode -eq "docker") {
  Write-Host "[1/4] Starting PostgreSQL (Docker)..." -ForegroundColor Yellow
  docker compose -f (Join-Path $Root "docker-compose.db.yml") up -d
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start PostgreSQL container." -ForegroundColor Red
    exit 1
  }

  # Wait for healthcheck to pass
  Write-Host "      Waiting for PostgreSQL to be ready..."
  $retries = 20
  do {
    Start-Sleep -Seconds 2
    $health = docker inspect --format "{{.State.Health.Status}}" kokarsi-postgres 2>$null
    $retries--
  } while ($health -ne "healthy" -and $retries -gt 0)

  if ($health -ne "healthy") {
    Write-Host "ERROR: PostgreSQL did not become healthy in time." -ForegroundColor Red
    exit 1
  }
  Write-Host "      PostgreSQL is healthy." -ForegroundColor Green

} else {
  Write-Host "[1/4] PostgreSQL Native mode - memastikan service berjalan..." -ForegroundColor Yellow
  # Cek apakah PostgreSQL native bisa diakses
  $pgReady = $false
  $retries = 5
  do {
    try {
      $result = & psql -U kokarsi -d kokarsi_karyawan -c "SELECT 1" 2>&1
      if ($LASTEXITCODE -eq 0) { $pgReady = $true }
    } catch {}
    if (-not $pgReady) { Start-Sleep -Seconds 2; $retries-- }
  } while (-not $pgReady -and $retries -gt 0)

  if (-not $pgReady) {
    Write-Host "WARNING: PostgreSQL native tidak bisa diakses. Pastikan service sudah berjalan." -ForegroundColor DarkYellow
    Write-Host "         Lanjutkan? (Y/N)" -NoNewline
    $continue = Read-Host
    if ($continue -ne "Y" -and $continue -ne "y") { exit 1 }
  } else {
    Write-Host "      PostgreSQL native is ready." -ForegroundColor Green
  }
}

# 2. Backend NestJS
Write-Host "[2/4] Starting Backend (NestJS)..." -ForegroundColor Yellow
$backendDist = Join-Path $Backend "dist\main.js"
if (-not (Test-Path $backendDist)) {
  Write-Host "ERROR: $backendDist not found. Run 'npm run build' in backend/ first." -ForegroundColor Red
  exit 1
}
Start-Process -FilePath "node" -ArgumentList $backendDist `
  -WorkingDirectory $Backend `
  -WindowStyle Minimized
Write-Host "      Backend started on :3001" -ForegroundColor Green

# Give the backend a moment to bind its port
Start-Sleep -Seconds 3

# 3. Frontend Nuxt production
Write-Host "[3/4] Starting Frontend (Nuxt production)..." -ForegroundColor Yellow
$frontendEntry = Join-Path $Root ".output\server\index.mjs"
if (-not (Test-Path $frontendEntry)) {
  Write-Host "ERROR: $frontendEntry not found. Run 'pnpm build' first." -ForegroundColor Red
  exit 1
}
Start-Process -FilePath "node" -ArgumentList $frontendEntry `
  -WorkingDirectory $Root `
  -WindowStyle Minimized
Write-Host "      Frontend started on :3000" -ForegroundColor Green

# 4. Cloudflare Tunnel
Write-Host "[4/4] Starting Cloudflare Tunnel..." -ForegroundColor Yellow
$cfConfig = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (-not (Test-Path $cfConfig)) {
  Write-Host "WARNING: $cfConfig not found. Tunnel will not start." -ForegroundColor DarkYellow
  Write-Host "         Run: cloudflared tunnel create kokarsi-tunnel" -ForegroundColor DarkYellow
  Write-Host "         Then create ~/.cloudflared/config.yml as described in docs/deploy-plan.md"
} else {
  Start-Process -FilePath "cloudflared" -ArgumentList "tunnel", "run", "kokarsi-tunnel" `
    -WindowStyle Minimized
  Write-Host "      Cloudflare Tunnel started" -ForegroundColor Green
}

Write-Host ""
Write-Host "All services started." -ForegroundColor Green
Write-Host ""
Write-Host "  Local frontend : http://localhost:3000"
Write-Host "  Local backend  : http://localhost:3001"
Write-Host "  Public domain  : https://kokarsi-sankyu.web.id"
Write-Host "  DB Mode        : $Mode"
Write-Host ""
Write-Host "To stop all services run: .\deploy\start.ps1 -Stop -Mode $Mode"