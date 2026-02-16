# Step 13 Boxed Smart Contain Run 1 - Forensic Map

Date: 2026-02-16
Scope: boxed preview initial framing vs Step 12 resize semantics

## What changed (root cause)

1. Current boxed runtime now uses effective camera lock:
   - `src/playground/GraphPhysicsPlaygroundShell.tsx:240`
   - `effectiveCameraLocked = cameraLocked || isBoxedRuntime`
2. That lock is passed into render settings:
   - `src/playground/GraphPhysicsPlaygroundShell.tsx:269`
3. Per-frame containment logic bails when locked:
   - `src/playground/rendering/camera.ts:180` (`if (locked) return;`)
   - containment invocation path: `src/playground/rendering/graphRenderingLoop.ts:397`

Effect:
- boxed preview no longer receives auto-fit containment behavior after mount.
- Step 12 resize semantics preserves current camera intent but does not guarantee initial readability framing.

## Existing fit/contain primitive to reuse

1. Existing world-bounds + fit logic lives in:
   - `src/playground/rendering/camera.ts:183-209`
2. Existing calculations:
   - world AABB from nodes (+ radius)
   - fit zoom from safe viewport area (`marginPx = min(width,height) * 0.15`)
   - pan solve to center target world bounds.

Recommendation:
- reuse the same transform assumptions and bounds inputs for boxed one-shot contain.

## Boxed resize semantics seam (already added)

1. Step 12 resize contract module:
   - `src/runtime/viewport/resizeSemantics.ts`
2. Boxed apply path:
   - `src/playground/GraphPhysicsPlaygroundShell.tsx:304-350`
3. Resize event applies camera once per true size change; does not per-frame refit.

## Preview load timing seam (for one-shot fit)

1. Preview passes interface through `pendingLoadInterface`:
   - `src/components/SampleGraphPreview.tsx:404-409`
2. Restore apply path in runtime:
   - `src/playground/GraphPhysicsPlaygroundShell.tsx:892-1060`
   - camera snapshot may be applied from saved record around `:1021`.

Implication:
- smart contain should run after restore/layout has materialized engine nodes and viewport is measured.

## Risks to avoid

1. Do not re-enable per-frame auto-fit in boxed mode (would fight user interaction).
2. Do not run one-shot fit on 1x1 sentinel viewport or empty graph.
3. Do not hook camera mutation into `useResizeObserverViewport` (measurement-only seam).

## Implementation direction for next runs

1. Add tiny pure boxed smart-contain primitive:
   - world bounds + viewport + padding -> one-shot camera snapshot.
2. Integrate in `GraphPhysicsPlaygroundShell` as boxed-only, one-shot effect.
3. Add reset-on-new-interface identity and user-interaction no-refit latch.

## Verification
- Command: `npm run build`
- Result: pass.
