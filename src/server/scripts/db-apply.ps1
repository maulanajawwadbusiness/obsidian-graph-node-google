$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
$sqlFile = Join-Path $PSScriptRoot "..\..\docs\db\next.sql"

if (-not (Test-Path $sqlFile)) {
    throw "Missing SQL file: $sqlFile"
}
$sqlFile = (Resolve-Path $sqlFile).Path

Write-Host "Applying $sqlFile"
psql $conn -f $sqlFile
