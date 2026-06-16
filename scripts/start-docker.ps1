[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [switch]$ExternalDatabase
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$envFilePath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
}
else {
    Join-Path $projectRoot $EnvFile
}
$envExamplePath = Join-Path $projectRoot ".env.example"

if (-not (Test-Path -LiteralPath $envFilePath)) {
    Copy-Item -LiteralPath $envExamplePath -Destination $envFilePath
    Write-Host "Created $envFilePath from .env.example. Review it before production use." -ForegroundColor Yellow
}

$composeArgs = @("compose", "--project-directory", $projectRoot, "--env-file", $envFilePath)
if ($ExternalDatabase) {
    $composeArgs += @("-f", (Join-Path $projectRoot "docker-compose.external-db.yml"))
}
$composeArgs += @("up", "-d")

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$port = "18080"
Get-Content -LiteralPath $envFilePath | ForEach-Object {
    if ($_ -match "^\s*ALERTYBLURTY_PORT\s*=\s*(.+?)\s*$") {
        $port = $Matches[1].Trim().Trim('"').Trim("'")
    }
}

Write-Host ""
Write-Host "AlertyBlurty is running." -ForegroundColor Green
Write-Host "Open http://localhost:$port and complete first-run setup."
Write-Host ""
Write-Host "View logs with: docker compose logs -f alertyblurty"
