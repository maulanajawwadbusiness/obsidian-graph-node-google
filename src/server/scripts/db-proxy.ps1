$ErrorActionPreference = "Stop"

$instance = [Environment]::GetEnvironmentVariable("INSTANCE_CONNECTION_NAME")
if (-not $instance) {
    throw "Missing environment variable: INSTANCE_CONNECTION_NAME"
}

Write-Host "Starting Cloud SQL Auth Proxy on 127.0.0.1:5432..."
cloud-sql-proxy $instance --port 5432
