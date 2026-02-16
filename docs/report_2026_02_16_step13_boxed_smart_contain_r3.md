# Step 13 Boxed Smart Contain Run 3 - One-shot Integration

Date: 2026-02-16

## Integrated boxed one-shot smart contain

File: `src/playground/GraphPhysicsPlaygroundShell.tsx`

Added boxed-only effect that applies one-shot fit camera framing.

### Gating in this run
1. `isBoxedRuntime === true`
2. `didSmartContainRef.current === false`
3. viewport has real size (`width > 1`, `height > 1`)
4. graph has valid world bounds from runtime nodes

### Applied flow
1. Read current runtime nodes via `engineRef.current.getNodeList()`.
2. Compute world bounds via `getWorldBoundsFromNodes(...)`.
3. Compute fit camera via `computeBoxedSmartContainCamera(...)` with:
   - viewport px
   - runtime rotation (`getGlobalAngle()`, `getCentroid()`)
   - zoom limits `0.1..10.0`
   - default asymmetric padding seam
4. Apply once via `applyCameraSnapshot(...)`.
5. Mark `didSmartContainRef.current = true`.

### Scope discipline
1. Boxed only.
2. No per-frame fit loop introduced.
3. Step 12 resize semantics effect remains active and unchanged.

### Dev counters wired
1. `recordBoxedSmartContainApplied()` on success.
2. `recordBoxedSmartContainSkippedNoBounds()` when nodes exist but bounds invalid.

## Verification
- Command: `npm run build`
- Result: pass.
