Set-Location -Path $PSScriptRoot
npm run db:proxy
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[start-db-proxy] command failed with exit code $LASTEXITCODE"
  Read-Host "Press Enter to close"
}
