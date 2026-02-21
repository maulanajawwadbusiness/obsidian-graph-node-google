param(
  [Parameter(Mandatory = $true)]
  [string]$LocalPath,
  [string]$ParentId,
  [string]$Name,
  [string]$ReplaceFileId,
  [string]$MimeType,
  [switch]$Convert,
  [ValidateSet("doc", "sheet", "slides")]
  [string]$ConvertTo,
  [string]$Account,
  [int]$Retries = 3,
  [int]$RetryDelaySec = 2
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gog -ErrorAction SilentlyContinue)) {
  Write-Error "gog command not found in PATH."
  exit 127
}

if (-not (Test-Path -LiteralPath $LocalPath -PathType Leaf)) {
  Write-Error "Local file not found: $LocalPath"
  exit 2
}

$resolvedLocalPath = (Resolve-Path -LiteralPath $LocalPath).Path

$attempt = 0
while ($attempt -lt $Retries) {
  $attempt++

  $args = @("drive", "upload", $resolvedLocalPath, "--json", "--no-input")
  if ($ParentId) { $args += @("--parent", $ParentId) }
  if ($Name) { $args += @("--name", $Name) }
  if ($ReplaceFileId) { $args += @("--replace", $ReplaceFileId) }
  if ($MimeType) { $args += @("--mime-type", $MimeType) }
  if ($Convert.IsPresent) { $args += "--convert" }
  if ($ConvertTo) { $args += @("--convert-to", $ConvertTo) }
  if ($Account) { $args += @("--account", $Account) }

  $rawOutput = & gog @args 2>&1
  $exitCode = $LASTEXITCODE
  $textOutput = ($rawOutput | Out-String).Trim()

  if ($exitCode -eq 0) {
    try {
      $parsed = $textOutput | ConvertFrom-Json -ErrorAction Stop
      if (-not $parsed.file -or -not $parsed.file.id) {
        throw "Upload response is missing file.id."
      }

      $result = [ordered]@{
        ok = $true
        attempt = $attempt
        fileId = [string]$parsed.file.id
        fileName = [string]$parsed.file.name
        mimeType = [string]$parsed.file.mimeType
        webViewLink = [string]$parsed.file.webViewLink
        raw = $parsed
      }

      $result | ConvertTo-Json -Depth 8
      exit 0
    } catch {
      $parseMessage = $_.Exception.Message
      if ($attempt -ge $Retries) {
        Write-Error "Upload succeeded but response parse/validation failed: $parseMessage`nRaw output: $textOutput"
        exit 3
      }
    }
  } else {
    if ($attempt -ge $Retries) {
      Write-Error "Upload failed after $attempt attempt(s). Last output: $textOutput"
      exit $exitCode
    }
  }

  Start-Sleep -Seconds $RetryDelaySec
}

Write-Error "Upload failed due to unknown control flow."
exit 1
