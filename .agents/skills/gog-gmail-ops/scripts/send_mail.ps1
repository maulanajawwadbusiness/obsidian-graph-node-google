param(
  [Parameter(Mandatory = $true)]
  [string]$To,
  [Parameter(Mandatory = $true)]
  [string]$Subject,
  [string]$Body,
  [string]$BodyFile,
  [string]$Cc,
  [string]$Bcc,
  [string]$ReplyToMessageId,
  [string]$ThreadId,
  [switch]$ReplyAll,
  [string]$ReplyTo,
  [string[]]$Attach,
  [string]$From,
  [switch]$Track,
  [switch]$TrackSplit,
  [switch]$Quote,
  [string]$Account,
  [switch]$DryRun,
  [int]$Retries = 2,
  [int]$RetryDelaySec = 2
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gog -ErrorAction SilentlyContinue)) {
  Write-Error "gog command not found in PATH."
  exit 127
}

if ([string]::IsNullOrWhiteSpace($Body) -and [string]::IsNullOrWhiteSpace($BodyFile)) {
  Write-Error "Either -Body or -BodyFile is required."
  exit 2
}

if (-not [string]::IsNullOrWhiteSpace($BodyFile)) {
  if ($BodyFile -ne "-" -and -not (Test-Path -LiteralPath $BodyFile -PathType Leaf)) {
    Write-Error "Body file not found: $BodyFile"
    exit 2
  }
}

if ($Attach) {
  foreach ($path in $Attach) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      Write-Error "Attachment file not found: $path"
      exit 2
    }
  }
}

$attempt = 0
while ($attempt -lt $Retries) {
  $attempt++

  $args = @("gmail", "send", "--to", $To, "--subject", $Subject, "--json", "--no-input")
  if ($Body) { $args += @("--body", $Body) }
  if ($BodyFile) { $args += @("--body-file", $BodyFile) }
  if ($Cc) { $args += @("--cc", $Cc) }
  if ($Bcc) { $args += @("--bcc", $Bcc) }
  if ($ReplyToMessageId) { $args += @("--reply-to-message-id", $ReplyToMessageId) }
  if ($ThreadId) { $args += @("--thread-id", $ThreadId) }
  if ($ReplyAll.IsPresent) { $args += "--reply-all" }
  if ($ReplyTo) { $args += @("--reply-to", $ReplyTo) }
  if ($From) { $args += @("--from", $From) }
  if ($Track.IsPresent) { $args += "--track" }
  if ($TrackSplit.IsPresent) { $args += "--track-split" }
  if ($Quote.IsPresent) { $args += "--quote" }
  if ($Account) { $args += @("--account", $Account) }
  if ($DryRun.IsPresent) { $args += "--dry-run" }

  if ($Attach) {
    foreach ($path in $Attach) {
      $args += @("--attach", $path)
    }
  }

  $rawOutput = & gog @args 2>&1
  $exitCode = $LASTEXITCODE
  $textOutput = ($rawOutput | Out-String).Trim()

  if ($exitCode -eq 0) {
    try {
      $parsed = $textOutput | ConvertFrom-Json -ErrorAction Stop
      if ($DryRun.IsPresent) {
        if (-not $parsed.dry_run) {
          throw "Dry-run requested but response missing dry_run=true."
        }
      }

      $result = [ordered]@{
        ok = $true
        attempt = $attempt
        dryRun = [bool]$DryRun.IsPresent
        response = $parsed
      }
      $result | ConvertTo-Json -Depth 10
      exit 0
    } catch {
      $parseMessage = $_.Exception.Message
      if ($attempt -ge $Retries) {
        Write-Error "Send mail parse/validation failed: $parseMessage`nRaw output: $textOutput"
        exit 3
      }
    }
  } else {
    if ($attempt -ge $Retries) {
      Write-Error "Send mail failed after $attempt attempt(s). Last output: $textOutput"
      exit $exitCode
    }
  }

  Start-Sleep -Seconds $RetryDelaySec
}

Write-Error "Send mail failed due to unknown control flow."
exit 1
