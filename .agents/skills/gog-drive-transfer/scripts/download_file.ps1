param(
  [Parameter(Mandatory = $true)]
  [string]$FileId,
  [string]$OutPath,
  [string]$Format,
  [string]$Account,
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

  $args = @("drive", "download", $FileId, "--json", "--no-input")
  if ($OutPath) { $args += @("--out", $OutPath) }
  if ($Format) { $args += @("--format", $Format) }
  if ($Account) { $args += @("--account", $Account) }

  $rawOutput = & gog @args 2>&1
  $exitCode = $LASTEXITCODE
  $textOutput = ($rawOutput | Out-String).Trim()

  if ($exitCode -eq 0) {
    try {
      $parsed = $textOutput | ConvertFrom-Json -ErrorAction Stop
      if (-not $parsed.path) {
        throw "Download response is missing path."
      }

      $resolvedPath = [string]$parsed.path
      if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        throw "Downloaded file does not exist on disk: $resolvedPath"
      }

      $fileInfo = Get-Item -LiteralPath $resolvedPath
      $result = [ordered]@{
        ok = $true
        attempt = $attempt
        fileId = $FileId
        path = $fileInfo.FullName
        sizeBytes = [int64]$fileInfo.Length
        raw = $parsed
      }

      $result | ConvertTo-Json -Depth 8
      exit 0
    } catch {
      $parseMessage = $_.Exception.Message
      if ($attempt -ge $Retries) {
        Write-Error "Download succeeded but response parse/validation failed: $parseMessage`nRaw output: $textOutput"
        exit 3
      }
    }
  } else {
    if ($attempt -ge $Retries) {
      Write-Error "Download failed after $attempt attempt(s). Last output: $textOutput"
      exit $exitCode
    }
  }

  Start-Sleep -Seconds $RetryDelaySec
}

Write-Error "Download failed due to unknown control flow."
exit 1
