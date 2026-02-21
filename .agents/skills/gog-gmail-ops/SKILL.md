---
name: gog-gmail-ops
description: Reliable Gmail read and send workflows through the local gog CLI with deterministic JSON output, retry handling, and strict input checks. Use this skill whenever Codex needs to search inbox mail, inspect message metadata by query, or send emails (including dry-run checks) without retyping gog command flags.
---

# GOG Gmail Ops

Use this skill to read and send Gmail through `gog` with stable scripting behavior.

## Workflow

1. Verify `gog` exists and auth is valid.
2. Use wrapper scripts in `scripts/` instead of raw ad-hoc commands.
3. Always call with `--json --no-input`.
4. Validate output shape before returning success.
5. Retry transient failures with bounded attempts.

## Commands

Read mail by query:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/gog-gmail-ops/scripts/read_mail.ps1" `
  -Query "in:inbox newer_than:7d" `
  -Max 10 `
  -Account "me@example.com"
```

Send mail:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/gog-gmail-ops/scripts/send_mail.ps1" `
  -To "team@example.com" `
  -Subject "Daily update" `
  -Body "Status attached." `
  -Account "me@example.com"
```

Dry-run send:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/gog-gmail-ops/scripts/send_mail.ps1" `
  -To "team@example.com" `
  -Subject "Draft check" `
  -Body "No send." `
  -DryRun
```

## Rules

- Prefer scripts in this skill for reliability.
- Never log secrets, tokens, or full private email bodies unless user explicitly asks.
- Use `-DryRun` before first-time sends or bulk sends.
- If command flags change, update scripts and `references/gog-gmail-commands.md` together.

## Files

- `scripts/read_mail.ps1`: query inbox and normalize result with retries.
- `scripts/send_mail.ps1`: send email with strict arg checks and dry-run support.
- `references/gog-gmail-commands.md`: verified command/flag reference.
