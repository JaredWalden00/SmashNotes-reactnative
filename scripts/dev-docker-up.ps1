$ErrorActionPreference = "Continue"

Write-Host "Checking Supabase local status..."
$statusOutput = & npx supabase status 2>&1
$statusText = ($statusOutput | Out-String)

function Remove-StaleSupabaseContainers {
  $projectName = Split-Path -Leaf (Get-Location)
  Write-Host "Cleaning stale Supabase containers for project '$projectName'..."

  $containerIds = & docker ps -a --filter "label=com.supabase.cli.project=$projectName" --format "{{.ID}}"

  if ($containerIds) {
    & docker rm -f $containerIds | Out-Null
    Write-Host "Removed stale Supabase containers."
  } else {
    Write-Host "No stale Supabase containers found."
  }
}

if ($statusText -match "supabase local development setup is running") {
  Write-Host "Supabase is already running."
} else {
  Write-Host "Starting Supabase local services..."
  $startOutput = & npx supabase start 2>&1
  $startText = ($startOutput | Out-String)
  $startOutput | ForEach-Object { Write-Host $_ }

  if ($LASTEXITCODE -ne 0) {
    if ($startText -match "already in use by container") {
      Write-Warning "Supabase container name conflict detected. Attempting one-time cleanup and retry..."
      Remove-StaleSupabaseContainers

      $retryOutput = & npx supabase start 2>&1
      $retryText = ($retryOutput | Out-String)
      $retryOutput | ForEach-Object { Write-Host $_ }

      if ($LASTEXITCODE -ne 0) {
        Write-Error "Supabase failed to start after cleanup. Fix Docker state and retry."
        if ($retryText) {
          Write-Host $retryText
        }
        exit $LASTEXITCODE
      }
    } else {
      Write-Error "Supabase failed to start. Fix Supabase/Docker first, then retry."
      if ($startText) {
        Write-Host $startText
      }
      exit $LASTEXITCODE
    }
  }
}

Write-Host "Starting Expo web container..."
& docker compose up --build --force-recreate expo-web
exit $LASTEXITCODE