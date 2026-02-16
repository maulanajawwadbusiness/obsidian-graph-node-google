# Step 5+7 Hardening Run 3 - Invariant Warning Dedupe Tightening

Date: 2026-02-16
Run: r3
Scope: reduce unbalance warning spam while keeping invariant output actionable.

## Changes

File changed:
- `src/runtime/resourceTracker.ts`

Updates:
1. Added source-level dedupe for unbalance warnings:
- new set: `warnedUnbalancedSources`
- `warnIfGraphRuntimeResourcesUnbalanced(source)` now warns at most once per `source`.

2. Kept signature-level dedupe as secondary guard:
- existing signature dedupe remains to avoid duplicate identical lines.

3. Negative-count hardening from r2 remains intact:
- snapshot cannot go negative.

## Resulting invariant behavior

- First unbalance at a source logs with full signature details.
- Repeated checks from the same unmount seam do not spam logs.
- Diagnostics remain readable and useful for lifecycle leak triage.
