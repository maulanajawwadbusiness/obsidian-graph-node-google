# Doc Open Jump Stability (Veils A–D)

## Problem summary + repro
- Open a long document; first content appears fast.
- Immediately drag/scroll to bottom or middle.
- Historically: blank void, bounce/flicker, and a late “settle” jump as hydration/measurement caught up.

## Root causes by veil

**Veil A — data readiness gap**
- Hydration builds from the top sequentially; bottom/middle blocks don’t exist yet.
- Virtualization had no concrete blocks to render for far offsets.

**Veil B — scroll geometry mismatch**
- Total height grows while user is at bottom; browser scroll + our anchoring fight.
- Estimated heights corrected later produced tiny jumps.

**Veil C — state race / partial updates**
- Separate updates for blocks, estimates, and range could temporarily desync.
- Range recalculation could observe stale prefix sums during hydration commits.
- Placeholder replacement could remount if keys shift per update.

**Veil D — missing apple layer**
- No immediate visual feedback for far jumps unless blocks already existed.
- Lacked a unified anchor policy and “seek intent” acceleration.

## Fixes implemented per veil

**A: data readiness**
- Tail placeholders render immediately with stable estimated geometry.
- Hydration boosts when seek intent is detected to reduce wait time.

**B: geometry stability**
- Bottom-lock anchoring while hydrating keeps the viewport pinned to the end.
- Scroll padding + cached total height used to avoid fighting scrollHeight changes.

**C: atomicity + ordering**
- Hydration chunk commits update blocks + estimate + isHydrating in one state write.
- Range recalculation is deferred to a single rAF after data changes.
- Placeholder IDs are stable by segment index to avoid remount flicker.

**D: apple layer**
- Seek intent detection (large scroll delta) triggers hydration priority.
- Placeholders guarantee immediate visual feedback for far jumps.
- Bottom-lock vs top-lock anchor policy maintained through measurements.

## New invariants / guards
- Placeholder geometry participates in prefix sums; no blank edges.
- Bottom-lock while hydrating; top anchor preserved otherwise.
- Hydration commits are atomic; range updates use a consistent snapshot.
- Seek intent is throttled to avoid per-scroll churn.

## How to verify
- Open a long doc and immediately drag to bottom: no blank, no bounce.
- Drag to middle immediately: placeholders appear, no flicker.
- Stay at bottom during hydration: pinned smoothly, no settle jump on completion.
- Let idle measurement or font-ready corrections run: no visible jumps.
- Confirm butter-scroll rules: no per-scroll setState, no scroll-time layout reads.
