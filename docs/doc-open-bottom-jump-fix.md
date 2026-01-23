# Doc Open Bottom-Jump Fix

## Root cause map

- **Empty bottom on immediate jump**
  - `DocumentContent` hydrates blocks sequentially from the top using `createBlockBuilder()` and only appends blocks in order, leaving the tail region unbuilt for a period after open.
  - `useVirtualBlocks()` computes scroll geometry strictly from the blocks it knows about, so a fast jump to the end lands in a range without real blocks and shows a void until hydration catches up.
- **Bounce/flicker while height grows**
  - `useVirtualBlocks()` recalculates prefix sums while hydration appends blocks and/or height measurements arrive.
  - When the user sits at the bottom, the existing anchor logic (top-offset delta) fights the browser’s own scroll geometry as total height grows, causing the bounce.
- **Tiny settle jump after measurement**
  - Idle measurements update block heights and prefix sums, then `useVirtualBlocks()` nudges `scrollTop` based on the visible range start, which is correct for top-lock reading but not for bottom-lock intent.

## Strategy chosen

**Combined strategy:**

1. **Stable placeholders** for unbuilt territory
   - Build a placeholder tail segment with stable estimated heights when hydration is still in progress.
   - The placeholder tail is virtualized just like real blocks, so the bottom region is never blank.
2. **Bottom-lock anchoring during jump-to-end**
   - Detect bottom intent while hydration is active and keep the user pinned to the bottom as height grows.
   - Maintain the existing top-anchoring behavior when the user is not at bottom.
3. **On-demand hydration boost**
   - When a bottom intent is detected, hydration temporarily boosts its chunk budget to accelerate tail completion.

## Invariants added

- **NO-BLANK tail:** unbuilt regions render placeholder blocks with stable estimated heights.
- **Bottom-lock override:** when in bottom-lock, height corrections and appended blocks keep the scroll pinned to the bottom in a single rAF.
- **Top-lock preserved:** when not bottom-locked, the existing visible-start anchor is preserved.
- **No scroll-time layout reads:** bottom-lock detection uses cached total height + padding, and DOM reads happen on idle/layout only.

## How to verify

1. Open a long document and immediately drag the scrollbar to the bottom.
   - You should see skeleton content instead of a blank void.
   - No bounce/flicker while hydration continues.
2. Keep the scrollbar pinned to the bottom during hydration.
   - It stays locked smoothly as blocks arrive.
3. Wait for hydration to finish (2–3 seconds on large docs).
   - No final “settle” jump.
4. Scroll normally (not at bottom).
   - Visible paragraph stays anchored while idle measurements apply.
5. Confirm butter-scroll invariants.
   - No per-scroll state updates beyond rAF-throttled range changes.
   - Measurements happen only on idle.
