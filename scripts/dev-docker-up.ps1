$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SmashNotes Dev Environment Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- Step 1: Supabase ----
Write-Host "[1/3] Checking Supabase local status..." -ForegroundColor Yellow
$statusOutput = & npx supabase status 2>&1
$statusText = ($statusOutput | Out-String)

function Remove-StaleSupabaseContainers {
  $projectName = Split-Path -Leaf (Get-Location)
  Write-Host "  Cleaning stale Supabase containers for project '$projectName'..."

  $containerIds = & docker ps -a --filter "label=com.supabase.cli.project=$projectName" --format "{{.ID}}"

  if ($containerIds) {
    & docker rm -f $containerIds | Out-Null
    Write-Host "  Removed stale Supabase containers." -ForegroundColor Green
  } else {
    Write-Host "  No stale Supabase containers found."
  }
}

if ($statusText -match "supabase local development setup is running") {
  Write-Host "  Supabase is already running." -ForegroundColor Green
} else {
  Write-Host "  Starting Supabase local services..."
  $startOutput = & npx supabase start 2>&1
  $startText = ($startOutput | Out-String)
  $startOutput | ForEach-Object { Write-Host "  $_" }

  if ($LASTEXITCODE -ne 0) {
    if ($startText -match "already in use by container") {
      Write-Warning "  Supabase container name conflict detected. Attempting cleanup..."
      Remove-StaleSupabaseContainers

      $retryOutput = & npx supabase start 2>&1
      $retryText = ($retryOutput | Out-String)
      $retryOutput | ForEach-Object { Write-Host "  $_" }

      if ($LASTEXITCODE -ne 0) {
        Write-Error "  Supabase failed to start after cleanup."
        if ($retryText) { Write-Host $retryText }
        exit $LASTEXITCODE
      }
    } else {
      Write-Error "  Supabase failed to start."
      if ($startText) { Write-Host $startText }
      exit $LASTEXITCODE
    }
  }
}

# ---- Step 2: Build containers ----
Write-Host ""
Write-Host "[2/3] Building Docker containers..." -ForegroundColor Yellow
& docker compose build
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker build failed."
  exit $LASTEXITCODE
}
Write-Host "  Build complete." -ForegroundColor Green

# ---- Step 3: Start all services ----
Write-Host ""
Write-Host "[3/3] Starting all services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Services:" -ForegroundColor Cyan
Write-Host "    Expo Web:    http://localhost:8081" -ForegroundColor White
Write-Host "    API Server:  http://localhost:3001" -ForegroundColor White
Write-Host "    Health:      http://localhost:3001/api/health" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services." -ForegroundColor Gray
Write-Host ""

& docker compose up --force-recreate
exit $LASTEXITCODE
