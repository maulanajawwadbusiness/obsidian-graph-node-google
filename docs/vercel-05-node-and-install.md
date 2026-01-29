# Node Version & Install

## Changes
- **Engines**: Added `"engines": { "node": ">=20.0.0" }` to `package.json`.
  - **Reason**: Ensures Vercel selects Node 20 or 22 (LTS) instead of 18 (eol-ish).

## Lockfile
- `package-lock.json` should be committed.
- `npm ci` is the preferred install command on CI.
