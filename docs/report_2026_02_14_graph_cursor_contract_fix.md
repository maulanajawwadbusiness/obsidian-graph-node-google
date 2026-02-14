# Report: Graph Cursor Contract Fix (2026-02-14)

## Summary
This report documents the fix for a graph screen cursor regression where the hand cursor was shown across all graph surface area, including empty space.

Final cursor contract:
- Empty graph space: `default`
- Hovering a Dot: `pointer`
- Active Dot drag: `grabbing`

## Root Cause
The graph interaction container used a static style with `cursor: 'grab'` in:
- `src/playground/graphPlaygroundStyles.ts`

That style applied to the entire graph surface (`MAIN_STYLE`), so the browser always rendered a hand/grab cursor, regardless of hover hit state.

## Implementation
### 1. Remove static hand cursor from container style
- Updated `src/playground/graphPlaygroundStyles.ts`
- Removed `cursor: 'grab'` from `MAIN_STYLE`.

### 2. Move cursor ownership to render-loop truth
- Updated `src/playground/GraphPhysicsPlaygroundShell.tsx`
    - Added `mainContainerRef` and attached it to the graph interaction container.
    - Passed this ref to `useGraphRendering`.
- Updated `src/playground/useGraphRendering.ts`
    - Extended hook props with `cursorTargetRef`.
    - Passed `cursorTargetRef` into `startGraphRenderLoop`.
- Updated `src/playground/rendering/graphRenderingLoop.ts`
    - Added `cursorTargetRef` to loop dependencies.
    - Derived cursor from authoritative state each frame:
        - `draggedNodeId != null` -> `grabbing`
        - `hoveredNodeId != null` -> `pointer`
        - otherwise -> `default`
    - Applied cursor only when changed to avoid redundant DOM writes.
    - Reset cursor to `default` on loop cleanup.

## Why This Is Safe
- No cursor writes in pointer handlers.
- Cursor updates are co-located with hover and drag truth in the render loop.
- DOM cursor writes are bounded by change detection.
- No topology, physics solver, or data-flow mutations were introduced.

## Behavior Matrix
- Before:
    - Empty space: hand/grab (incorrect)
    - Dot hover: hand/grab (ambiguous)
    - Dragging Dot: hand/grab
- After:
    - Empty space: default (correct)
    - Dot hover: pointer (correct)
    - Dragging Dot: grabbing (correct)

## Validation Checklist
- [x] TypeScript compile + production build succeeded (`npm run build`).
- [ ] Manual graph validation in browser:
    - [ ] Empty space shows default cursor.
    - [ ] Dot hover shows pointer cursor.
    - [ ] Dot drag shows grabbing cursor.
    - [ ] Pointer leave/cancel/blur does not leave stuck grabbing state.
