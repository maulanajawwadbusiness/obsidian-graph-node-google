$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select now();"
