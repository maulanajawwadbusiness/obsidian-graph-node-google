$ErrorActionPreference = "Stop"

function Require-Env($name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not $value) {
        throw "Missing environment variable: $name"
    }
    return $value
}

function Get-DbConnString {
    $dbName = Require-Env "DB_NAME"
    $dbUser = Require-Env "DB_USER"
    $dbPassword = Require-Env "DB_PASSWORD"

    $env:PGPASSWORD = $dbPassword
    return "host=127.0.0.1 port=5432 dbname=$dbName user=$dbUser sslmode=disable"
}
