[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [switch]$ExternalDatabase
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
    Copy-Item -LiteralPath ".env.example" -Destination $EnvFile
    Write-Host "Created $EnvFile from .env.example. Review it before production use." -ForegroundColor Yellow
}

$composeArgs = @("compose", "--env-file", $EnvFile)
if ($ExternalDatabase) {
    $composeArgs += @("-f", "docker-compose.external-db.yml")
}
$composeArgs += @("up", "-d")

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$port = "18080"
Get-Content -LiteralPath $EnvFile | ForEach-Object {
    if ($_ -match "^\s*ALERTYBLURTY_PORT\s*=\s*(.+?)\s*$") {
        $port = $Matches[1].Trim().Trim('"').Trim("'")
    }
}

Write-Host ""
Write-Host "AlertyBlurty is running." -ForegroundColor Green
Write-Host "Open http://localhost:$port and complete first-run setup."
Write-Host ""
Write-Host "View logs with: docker compose logs -f alertyblurty"
