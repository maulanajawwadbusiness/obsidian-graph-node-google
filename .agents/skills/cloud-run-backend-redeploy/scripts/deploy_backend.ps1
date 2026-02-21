param(
  [string]$Service = "arnvoid-api",
  [string]$Project = "arnvoid-project",
  [string]$Region = "asia-southeast2",
  [string]$Source = ".",
  [string]$CloudSqlInstance = "arnvoid-project:asia-southeast2:arnvoid-postgres",
  [string]$DbName = "arnvoid",
  [string]$DbUser = "arnvoid_app",
  [string]$GoogleClientId = "242743978070-vl4aap4odmiiqjrhoprtht2qd6elu504.apps.googleusercontent.com",
  [string]$BetaFreeMode = "1",
  [string]$DbPasswordSecretRef = "DB_PASSWORD:latest",
  [string]$OpenAiSecretRef = "OPENAI_API_KEY:latest",
  [string]$OpenRouterSecretRef = "OPENROUTER_API_KEY:latest",
  [bool]$AllowUnauthenticated = $true,
  [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name command not found in PATH."
  }
}

function Build-ArgString([string[]]$parts) {
  return ($parts | ForEach-Object {
      if ($_ -match '[\s,`"]') {
        '"' + ($_ -replace '"', '\"') + '"'
      } else {
        $_
      }
    }) -join " "
}

Assert-CommandExists "gcloud"

$envVars = @(
  "INSTANCE_CONNECTION_NAME=$CloudSqlInstance",
  "DB_NAME=$DbName",
  "DB_USER=$DbUser",
  "GOOGLE_CLIENT_ID=$GoogleClientId",
  "BETA_FREE_MODE=$BetaFreeMode"
) -join ","

$secretVars = @(
  "DB_PASSWORD=$DbPasswordSecretRef",
  "OPENAI_API_KEY=$OpenAiSecretRef",
  "OPENROUTER_API_KEY=$OpenRouterSecretRef"
) -join ","

$deployArgs = @(
  "run", "deploy", $Service,
  "--project", $Project,
  "--source", $Source,
  "--region", $Region,
  "--add-cloudsql-instances", $CloudSqlInstance,
  "--update-env-vars", $envVars,
  "--update-secrets", $secretVars
)

if ($AllowUnauthenticated) {
  $deployArgs += "--allow-unauthenticated"
}

if ($PrintOnly.IsPresent) {
  $commandText = "gcloud " + (Build-ArgString $deployArgs)
  [ordered]@{
    ok = $true
    mode = "print-only"
    command = $commandText
    commandParts = @("gcloud") + $deployArgs
  } | ConvertTo-Json -Depth 4
  exit 0
}

# Snapshot pre-deploy state for comparison.
$beforeRaw = & gcloud run services describe $Service --project $Project --region $Region --format=json 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Failed to describe Cloud Run service before deploy. Output: $($beforeRaw | Out-String)"
}

$before = ($beforeRaw | Out-String | ConvertFrom-Json)

$deployRaw = & gcloud @deployArgs 2>&1
$deployExit = $LASTEXITCODE
if ($deployExit -ne 0) {
  throw "Deploy failed with exit code $deployExit. Output: $($deployRaw | Out-String)"
}

$afterRaw = & gcloud run services describe $Service --project $Project --region $Region --format=json 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Failed to describe Cloud Run service after deploy. Output: $($afterRaw | Out-String)"
}

$after = ($afterRaw | Out-String | ConvertFrom-Json)

$latestReady = [string]$after.status.latestReadyRevisionName
if ([string]::IsNullOrWhiteSpace($latestReady)) {
  throw "Deploy completed but latestReadyRevisionName is empty."
}

$latestTraffic = @($after.status.traffic | Where-Object { $_.latestRevision -eq $true })
$latestPercent = 0
if ($latestTraffic.Count -gt 0 -and $null -ne $latestTraffic[0].percent) {
  $latestPercent = [int]$latestTraffic[0].percent
}

if ($latestPercent -ne 100) {
  throw "Latest revision traffic is not 100%. Current latest percent: $latestPercent"
}

$requiredEnvKeys = @(
  "INSTANCE_CONNECTION_NAME",
  "DB_NAME",
  "DB_USER",
  "GOOGLE_CLIENT_ID"
)

$containerEnv = @($after.spec.template.spec.containers[0].env)
$envNames = @($containerEnv | ForEach-Object { $_.name })
$missingKeys = @($requiredEnvKeys | Where-Object { $envNames -notcontains $_ })
if ($missingKeys.Count -gt 0) {
  throw "Post-deploy required env keys missing: $($missingKeys -join ', ')"
}

[ordered]@{
  ok = $true
  service = $Service
  project = $Project
  region = $Region
  previousReadyRevision = [string]$before.status.latestReadyRevisionName
  latestReadyRevision = $latestReady
  latestRevisionTrafficPercent = $latestPercent
  appliedEnvVars = @(
    "INSTANCE_CONNECTION_NAME",
    "DB_NAME",
    "DB_USER",
    "GOOGLE_CLIENT_ID",
    "BETA_FREE_MODE"
  )
  appliedSecrets = @(
    "DB_PASSWORD",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY"
  )
} | ConvertTo-Json -Depth 6
