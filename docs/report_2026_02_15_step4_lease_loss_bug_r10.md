# Step 4 Lease-Loss Bug Fix Run 10: Runtime Invariant Self-Check

Date: 2026-02-15
Scope: add dev-only guardrail for lease snapshot consistency.

## File changed

- `src/runtime/graphRuntimeLease.ts`

## Added guardrail

1. Dev-only one-time invariant check:
- validates snapshot active fields consistency:
  - either all null (`no active lease`)
  - or all non-null (`active lease fully defined`)

2. Warn-once behavior:
- logs `invariant_violation` once if inconsistent snapshot is detected.
- no production overhead beyond static function presence (execution guarded by `import.meta.env.DEV`).

## Why this closes the loop

- runtime ownership is now observable, self-enforcing, and guarded by invariant checks.
- if future refactors break snapshot coherence, development receives immediate signal.