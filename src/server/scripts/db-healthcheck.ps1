$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select * from healthcheck order by id desc limit 10;"
