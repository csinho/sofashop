# Republica Edge Functions WhatsApp (send, notify-checkout, webhook).
# Uso: $env:SUPABASE_ACCESS_TOKEN = "sbp_..." ; .\scripts\deploy-whatsapp-all.ps1
# Incluir admin: .\scripts\deploy-whatsapp-all.ps1 -IncludeAdmin

param([switch]$IncludeAdmin)

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
  Write-Host ""
  Write-Host "Token nao encontrado." -ForegroundColor Yellow
  Write-Host "Defina SUPABASE_ACCESS_TOKEN no .env ou:"
  Write-Host "  https://supabase.com/dashboard/account/tokens"
  Write-Host ""
  $token = Read-Host "Cole o token aqui (ou Enter para cancelar)"
  if (-not $token) { throw "Token obrigatorio." }
  $env:SUPABASE_ACCESS_TOKEN = $token.Trim()
}

$functions = @('whatsapp-send', 'whatsapp-notify-checkout', 'whatsapp-webhook')
if ($IncludeAdmin) {
  $functions = @('whatsapp-admin') + $functions
}

foreach ($fn in $functions) {
  Write-Host ""
  Write-Host "=== $fn ===" -ForegroundColor Cyan
  node scripts/bundle-whatsapp-edge.mjs $fn
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node scripts/publish-edge-from-bundle.mjs $fn
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Deploy concluido: $($functions -join ', ')" -ForegroundColor Green
