# Welcome2 Back-Jump Epoch Guard Fix (Stale Timeout Race)

Date: 2026-02-14

## Scope
- Prevent stale A/B/C timeout callbacks from older `[<-]` sequences mutating state.
- Preserve existing back-jump behavior, timings, and no-op boundaries.

## Problem
- `clearTimeout` alone is not enough when callback execution is already queued/in-progress.
- Under rapid clicks, stale callbacks can fire out of order and cause unexpected seek jumps.

## Fix
File: `src/screens/Welcome2.tsx`

1. Added sequence epoch ref:
- `backJumpEpochRef`

2. Invalidation on cancel/reset:
- `cancelBackJumpSequence()` now increments epoch first.
- Then clears timeout refs and resets stage/flags.

3. Sequence-local epoch capture:
- New `[<-]` sequence captures `localEpoch` after cancel/reset.

4. Callback guards in all stages:
- Stage A callback: return early if epoch mismatch.
- Stage B callback: return early if epoch mismatch.
- Stage C callback: return early if epoch mismatch.

Only matching epoch callbacks are allowed to run `seekWithManualInteraction()` and stage updates.

## Why This Works
- Any new cancel/restart invalidates all previous tokens immediately.
- Even if an old callback still executes, token mismatch makes it a no-op.
- Spam click behavior becomes deterministic: newest sequence only.

## Preserved Behavior
- Stage timing unchanged (`A=400ms`, `B=200ms`).
- Part 0 strict no-op unchanged.
- Back-step cut ratio unchanged (`0.7`).
- No ellipsis behavior reintroduced.

## Verification
- `npm run build` passed.

## Manual Verification Checklist
1. Spam `[<-]` during Stage A hold.
2. Spam `[<-]` during Stage B hold.
3. Click `[<-]` then quickly `[->]`.
4. Leave/Unmount during active hold.

Expected for all:
- no late stale jumps from older callbacks.
- only newest sequence may mutate state.
