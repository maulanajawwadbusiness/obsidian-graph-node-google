$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select table_name from information_schema.tables where table_schema = 'public' order by table_name;"
