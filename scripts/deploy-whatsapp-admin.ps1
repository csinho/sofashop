# Republica whatsapp-admin no Supabase (sem login pelo navegador).
# Uso: .\scripts\deploy-whatsapp-admin.ps1
# Ou: $env:SUPABASE_ACCESS_TOKEN = "sbp_..." ; .\scripts\deploy-whatsapp-admin.ps1

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

node scripts/bundle-whatsapp-edge.mjs whatsapp-admin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node scripts/publish-edge-from-bundle.mjs whatsapp-admin
exit $LASTEXITCODE
