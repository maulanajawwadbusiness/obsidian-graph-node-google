# Step 5+7 Hardening Run 2 - Resource Tracker Negative Count Guard

Date: 2026-02-16
Run: r2
Scope: dev-only hardening so tracker counts cannot persist below zero.

## Changes

File changed:
- `src/runtime/resourceTracker.ts`

Behavior updates:
1. Negative decrement is now blocked and clamped:
- If `delta === -1` and current count is `0` or below, the counter is set to `0` and function returns.
- This prevents negative counts from ever persisting in tracker state.

2. Warn-once diagnostics per resource name:
- Added `warnedNegativeNames` set.
- First invalid decrement per resource emits warning with:
  - resource name
  - current count
  - attempted delta
  - short stack excerpt (first few lines)
- Subsequent repeats for same resource name do not spam logs.

## Why this closes the audit item

- Dev counters now stay non-negative by construction.
- Invalid release patterns are still visible and actionable via one-time warnings.
- Snapshot remains useful and stable because it cannot drift into negative values.

## Example warning format

`[ResourceTracker] attempted negative decrement clamped name=<name> current=0 delta=-1 stack=<trimmed>`
