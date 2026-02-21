# GOG Gmail Command Notes

Snapshot validated on `gog` build `v0.11.0`.

## Read Email

Search threads:

```powershell
gog gmail search "in:inbox newer_than:7d" --max 10 --json --no-input
```

Key flags:

- `--max <n>`
- `--fail-empty`
- `--account <email>`

## Send Email

Basic send:

```powershell
gog gmail send --to "team@example.com" --subject "Status" --body "Done." --json --no-input
```

Dry-run:

```powershell
gog gmail send --to "team@example.com" --subject "Check" --body "No send." --json --no-input --dry-run
```

Key send flags:

- `--to`
- `--subject`
- `--body` or `--body-file`
- `--cc`
- `--bcc`
- `--reply-to-message-id`
- `--thread-id`
- `--reply-all`
- `--attach` (repeatable)
- `--from`
- `--track`
- `--track-split`
- `--quote`
- `--account`

## JSON Shapes Observed

Search success:

```json
{
  "nextPageToken": "token",
  "threads": [
    {
      "id": "thread-id",
      "date": "2026-02-21 02:48",
      "from": "sender@example.com",
      "subject": "Subject",
      "labels": ["INBOX"],
      "messageCount": 1
    }
  ]
}
```

Send dry-run success:

```json
{
  "dry_run": true,
  "op": "gmail.send",
  "request": {
    "to": ["example@example.com"],
    "subject": "dryrun test"
  }
}
```

## Troubleshooting

- If auth fails, run `gog login <email>` and retry with `--account`.
- For scripted runs, always include `--no-input`.
- Use dry-run for first-time recipient lists.
