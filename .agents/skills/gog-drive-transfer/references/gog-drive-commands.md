# GOG Drive Command Notes

Snapshot validated on `gog` build `v0.11.0`.

## Core Commands

Upload:

```powershell
gog drive upload <localPath> --json --no-input [--parent <folderId>] [--name <fileName>] [--replace <fileId>]
```

Download:

```powershell
gog drive download <fileId> --json --no-input [--out <path>] [--format <fmt>]
```

List folder:

```powershell
gog drive ls --json --no-input [--parent <folderId>] [--max <n>]
```

## Known Flags Used by Skill Scripts

- Common:
  - `--json`
  - `--no-input`
  - `--account <email>`
- Upload:
  - `--parent <folderId>`
  - `--name <fileName>`
  - `--replace <fileId>`
  - `--mime-type <mime>`
  - `--convert`
  - `--convert-to doc|sheet|slides`
- Download:
  - `--out <path>`
  - `--format pdf|csv|xlsx|pptx|txt|png|docx`

## Expected JSON Shapes

Upload success sample:

```json
{
  "file": {
    "id": "file-id",
    "mimeType": "text/plain",
    "name": "example.txt",
    "webViewLink": "https://drive.google.com/file/d/file-id/view"
  }
}
```

Download success sample:

```json
{
  "path": "C:\\tmp\\example.txt",
  "size": 42
}
```

## Troubleshooting

- If `gog` is missing, install it and verify `gog --help` works.
- If auth fails, run `gog login <email>` and retry with `--account <email>`.
- If API errors are transient, increase retry count and delay in script params.
- If command flags drift in future `gog` versions, update scripts and this reference.
