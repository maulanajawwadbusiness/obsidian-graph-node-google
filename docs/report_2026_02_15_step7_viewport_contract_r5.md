# Step 7 Viewport Contract Report (Run 5)

Date: 2026-02-15
Focus: docs + invariants + tiny debug snapshot helper

## Code Changes

1. `src/runtime/viewport/graphViewport.tsx`
- added `getGraphViewportDebugSnapshot(viewport)` helper.
- returns a serializable, plain-object snapshot of viewport fields.
- intended for lightweight dev inspection without mutating runtime behavior.

2. `docs/system.md`
- added section: `2.10 Graph Viewport Contract (2026-02-15)`.
- documented:
  - contract fields and meanings
  - provider/hook/api location
  - graph-screen and preview wiring
  - explicit step boundary for step 8 and step 9
  - manual verification checklist

## Step 7 Invariants Locked
- single viewport contract exists and is available in both runtime paths.
- graph-screen path remains app-mode/window default.
- preview path provides boxed/container value (one-time snapshot for now).
- no clamp-site or live resize behavior migration performed in this step.
