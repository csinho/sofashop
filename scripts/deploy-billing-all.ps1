# Republica Edge Functions de billing (billing, woovi-webhook, billing-cron).
# Uso: $env:SUPABASE_ACCESS_TOKEN = "sbp_..." ; .\scripts\deploy-billing-all.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $envFile = Join-Path $root ".env"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*SUPABASE_ACCESS_TOKEN\s*=\s*["'']?([^"''\s#]+)["'']?\s*$') {
        $env:SUPABASE_ACCESS_TOKEN = $matches[1].Trim()
      }
    }
  }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN no .env ou ambiente." -ForegroundColor Yellow
  exit 1
}

$functions = @('billing', 'woovi-webhook', 'billing-cron')

foreach ($fn in $functions) {
  Write-Host ""
  Write-Host "=== $fn ===" -ForegroundColor Cyan
  node scripts/bundle-whatsapp-edge.mjs $fn
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node scripts/publish-edge-from-bundle.mjs $fn
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Deploy billing concluido: $($functions -join ', ')" -ForegroundColor Green
