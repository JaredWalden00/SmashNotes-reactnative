$ErrorActionPreference = "Continue"

Write-Host "Checking Supabase local status..."
$statusOutput = & npx supabase status 2>&1
$statusText = ($statusOutput | Out-String)

if ($statusText -match "supabase local development setup is running") {
  Write-Host "Supabase is already running."
} else {
  Write-Host "Starting Supabase local services..."
  & npx supabase start

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Supabase failed to start. Fix Supabase/Docker first, then retry."
    exit $LASTEXITCODE
  }
}

Write-Host "Starting Expo web container..."
& docker compose up --build --force-recreate expo-web
exit $LASTEXITCODE