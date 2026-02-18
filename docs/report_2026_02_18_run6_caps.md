# Run 6 Caps Report
Date: 2026-02-18
Scope: prompt balloon + send disable for pasted text caps.

## Changes
### Prompt UX wiring
- `src/screens/EnterPrompt.tsx`
  - Added beta caps mode guard via `BETA_CAPS_MODE_ENABLED`.
  - Added live pasted-text word counting with canonical split.
  - Added mount-time fetch to `GET /api/beta/usage/today`.
  - Added derived cap states:
    - per-doc exceeded (text words > 7500)
    - daily exceeded (remaining <= 0 when server caps enabled)
    - usage loading / usage error
  - Added send disable logic for prompt:
    - disabled when per-doc exceeded OR daily exceeded OR usage loading OR usage error.

### PromptCard status variants
- `src/components/PromptCard.tsx`
  - Extended `statusMessage.kind` from `error` to `info | error`.
  - Added style variants:
    - info balloon style
    - error balloon style

## Copy in this run
- Under-limit info:
  - `beta limit: max 7,500 words per document. daily: 150,000 words (resets 07:00 wib).`
- Per-doc exact over-limit text:
  - `Document is more than 7500 words`
- Daily exceeded text:
  - `daily beta limit reached (150,000 words). resets 07:00 wib.`
- Loading text:
  - `checking beta usage...`

## Notes
- This run is paste-only UX guard.
- Upload pre-parse and upload-specific disable flow is intentionally deferred to Run 7.

## Verification
- repo root: `npm run build` passed.
- `src/server`: `npm run build` passed.
