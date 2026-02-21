---
name: gog-drive-transfer
description: Reliable Google Drive file transfer with the local gog CLI, including deterministic upload and download workflows with retries and verification. Use this skill whenever Codex needs to move files between local disk and Google Drive, preserve consistent scripting output, select Drive parent folders, replace existing Drive file content, or export Google-native files during download.
---

# GOG Drive Transfer

Run robust local-to-Drive and Drive-to-local file transfers through `gog` with predictable JSON output and explicit checks.

## Workflow

1. Verify `gog` is installed and authenticated.
2. Use wrappers in `scripts/` instead of raw commands when reliability matters.
3. Always run with JSON mode and `--no-input`.
4. Parse and validate transfer result:
   - upload: require returned `file.id`
   - download: require output path exists on disk
5. Retry transient failures before returning final error.

## Quick Commands

Upload:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/gog-drive-transfer/scripts/upload_file.ps1" `
  -LocalPath "C:\tmp\report.pdf" `
  -ParentId "1AbCdEfFolderId" `
  -Account "me@example.com"
```

Download:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/gog-drive-transfer/scripts/download_file.ps1" `
  -FileId "1AbCdEfFileId" `
  -OutPath "C:\tmp\downloaded-report.pdf" `
  -Account "me@example.com"
```

## Rules

- Prefer wrapper scripts for upload/download tasks.
- Keep all outputs machine-readable JSON when scripting.
- Do not log secrets, OAuth tokens, or cookies.
- Use `-Retries` and `-RetryDelaySec` for unstable connections.
- If command semantics change, inspect `references/gog-drive-commands.md` and adjust scripts.

## Files

- `scripts/upload_file.ps1`: upload/create/replace with retries and response validation.
- `scripts/download_file.ps1`: download/export with retries and on-disk validation.
- `references/gog-drive-commands.md`: current command and flag map used by this skill.
