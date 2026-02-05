$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
$outputDir = Join-Path $PSScriptRoot "..\..\docs\db"
$outputFile = Join-Path $outputDir "schema.sql"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}
$outputDir = (Resolve-Path $outputDir).Path
$outputFile = Join-Path $outputDir "schema.sql"

Write-Host "Dumping schema to $outputFile"
pg_dump $conn --schema-only --no-owner --no-privileges --file $outputFile
