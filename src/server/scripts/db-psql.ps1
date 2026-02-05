$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
Write-Host "Opening psql..."
psql $conn
