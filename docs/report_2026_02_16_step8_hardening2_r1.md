# Step 8 Hardening Round 2 Run 1 - Forensic Strategy Lock

Date: 2026-02-16
Run: r1
Scope: no behavior changes. Forensic scan and minimal hardening strategy selection for `useResizeObserverViewport`.

## Current trigger map (from hook)

File: `src/runtime/viewport/useResizeObserverViewport.ts`

Current viewport refresh triggers:
1. Initial mount flush after observer bind.
2. ResizeObserver callback (size-driven).
3. Window listeners:
   - `scroll` (capture, passive)
   - `resize` (passive)
4. `visualViewport` listeners when available:
   - `scroll` (passive)
   - `resize` (passive)
5. Internal bounded settle continuation rAF.

Current resilience already present:
- BCR origin source (`left/top`) is correct.
- RO size precedence and fallback are correct.
- single pending rAF guard.
- settle hard cap and warn-once.
- strict cleanup for observer/listeners/raf.

## Remaining movement/staleness gap

Layout movement can still occur without guaranteed window scroll/resize and without size change:
- sibling transitions pushing container
- font swap / late style/layout reflow
- composition/layout shifts immediately before user interaction

Impact:
- origin can be stale until the next movement/resize signal reaches the hook.
- stale origin risk is highest right before pointer/wheel interaction in boxed preview.

## Chosen hardening strategy (minimal, no permanent polling)

1. Interaction-triggered refresh on target element:
   - `pointerenter`: immediate refresh + short settle seed
   - `pointermove`: throttled refresh (120ms)
   - `wheel`: immediate refresh
   - passive listeners only, no preventDefault
2. Mount stabilization burst:
   - after target bind, seed bounded settle burst (20 stable frames, still bounded by global cap).
3. Visibility safety:
   - when `document.hidden`, stop settle continuation.
   - when visible again, schedule one refresh.
4. Listener hygiene:
   - stable handler identity + symmetric attach/detach.
   - target swap safe and strictmode safe.
5. Dev observability:
   - replace/augment generic counters with flush-reason counters (`ro/scroll/vv/interaction/mount/visibility`).

## Why this covers the gap

- Interaction-triggered refresh guarantees an origin refresh right before user-facing overlay math.
- Mount burst captures startup reflow/transition settling without permanent loops.
- Visibility guard prevents hidden-tab settle churn.
- Existing bounded scheduler + hard cap preserves 60fps doctrine and avoids hidden pollers.

## Verification

- `npm run build` passes.
