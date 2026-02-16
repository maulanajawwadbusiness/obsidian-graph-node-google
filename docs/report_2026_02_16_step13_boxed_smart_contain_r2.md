# Step 13 Boxed Smart Contain Run 2 - Primitive Module

Date: 2026-02-16

## Added
File: `src/playground/rendering/boxedSmartContain.ts`

## Exports
1. Bounds utilities:
   - `getWorldBoundsFromNodes(nodes)`
2. Fit primitive:
   - `computeBoxedSmartContainCamera(input)`
3. Padding config seam:
   - `getDefaultBoxedSmartContainPadding()`
4. Dev counters rails:
   - `recordBoxedSmartContainApplied()`
   - `recordBoxedSmartContainSkippedUserInteracted()`
   - `recordBoxedSmartContainSkippedNoBounds()`
   - `getBoxedSmartContainDebugSnapshot()`

## Algorithm

1. Build world bounds (x,y,radius) from existing node data.
2. Rotate bounds corners around runtime pivot if rotation is present.
3. Fit zoom using px-available area:
   - `availableW = viewportW - leftPad - rightPad`
   - `availableH = viewportH - topPad - bottomPad`
   - `fitZoom = min(availableW/boundsW, availableH/boundsH)`
4. Clamp zoom with provided limits.
5. Solve pan so bounds center maps to viewport center.

## Padding strategy

Default asymmetric px padding (readability-first):
- top 64
- right 64
- bottom 96
- left 64

Bottom pad is intentionally heavier for label readability/clipping safety.

## Scope discipline

1. Pure module only in this run.
2. No runtime integration yet.
3. No app-mode behavior touched.

## Verification
- Command: `npm run build`
- Result: pass.
