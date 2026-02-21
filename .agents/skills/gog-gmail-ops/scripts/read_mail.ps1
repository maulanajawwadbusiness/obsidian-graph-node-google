param(
  [Parameter(Mandatory = $true)]
  [string]$Query,
  [int]$Max = 10,
  [string]$Account,
  [switch]$FailEmpty,
  [int]$Retries = 3,
  [int]$RetryDelaySec = 2
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gog -ErrorAction SilentlyContinue)) {
  Write-Error "gog command not found in PATH."
  exit 127
}

$attempt = 0
while ($attempt -lt $Retries) {
  $attempt++

  $args = @("gmail", "search", $Query, "--max", "$Max", "--json", "--no-input")
  if ($Account) { $args += @("--account", $Account) }
  if ($FailEmpty.IsPresent) { $args += "--fail-empty" }

  $rawOutput = & gog @args 2>&1
  $exitCode = $LASTEXITCODE
  $textOutput = ($rawOutput | Out-String).Trim()

  if ($exitCode -eq 0) {
    try {
      $parsed = $textOutput | ConvertFrom-Json -ErrorAction Stop
      if (-not $parsed.threads) {
        throw "Search response is missing threads."
      }

      $threads = @($parsed.threads)
      $result = [ordered]@{
        ok = $true
        attempt = $attempt
        query = $Query
        count = $threads.Count
        nextPageToken = [string]$parsed.nextPageToken
        threads = $threads
      }
      $result | ConvertTo-Json -Depth 10
      exit 0
    } catch {
      $parseMessage = $_.Exception.Message
      if ($attempt -ge $Retries) {
        Write-Error "Read mail parse/validation failed: $parseMessage`nRaw output: $textOutput"
        exit 3
      }
    }
  } else {
    if ($attempt -ge $Retries) {
      Write-Error "Read mail failed after $attempt attempt(s). Last output: $textOutput"
      exit $exitCode
    }
  }

  Start-Sleep -Seconds $RetryDelaySec
}

Write-Error "Read mail failed due to unknown control flow."
exit 1
