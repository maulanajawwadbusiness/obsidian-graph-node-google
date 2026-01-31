# Constraint Fight HUD Postmortem

## Symptom
The Constraint Fight HUD (Energy Ledger, Fight Ledger) and Advanced Toggles were missing from the runtime debug panel, despite the code apparently being written in `CanvasOverlays.tsx`.

## Root Cause Analysis
1.  **Missing Data Plumbing (Ledgers)**:
    *   **Failure**: The `CanvasOverlays` component guards the ledger displays with `{metrics.renderDebug?.energyLedger && ...}`.
    *   **Cause**: The `renderDebug` object in `metrics.ts` (which feeds `PlaygroundMetrics`) was not receiving the ledger data from the `PhysicsEngine`. The `createMetricsTracker` function was only copying basic `RenderDebugInfo` (draw order, pass indices) and failing to copy the new `energyLedger` and `fightLedger` arrays from `engine.getDebugStats()`.
    *   **Result**: `metrics.renderDebug.energyLedger` was undefined, so the UI blocks never rendered.

2.  **Missing Toggles (Advanced)**:
    *   **Failure**: User reported missing "No Constraints" / "No Reconcile" toggles.
    *   **Cause**: These toggles were present in `CanvasOverlays.tsx` but hidden behind the `showAdvanced` local state gate ("Show Advanced Physics Toggles"). If the user's screenshot showed the checkbox unchecked, the toggles were legally hidden. However, if the user checked the box and still didn't see them, it implies a stale build where the new `CanvasOverlays.tsx` changes hadn't propagated.
    *   **Note**: There was also a syntax error (stray `</div>`) corrected in `CanvasOverlays.tsx` earlier, which might have caused rendering issues in that section.

## Corrective Actions
1.  **Fixed Plumbing in `metrics.ts`**:
    *   Updated `createMetricsTracker` to explicitly fetch `engine.getDebugStats()` and merge `energyLedger` and `fightLedger` into the `renderDebug` object before `setMetrics`.

2.  **Verified UI in `CanvasOverlays.tsx`**:
    *   Added "Constraint Fight Ledger" block (verified present).
    *   Added "HUD v1.1 (fight-ledger enabled)" version indicator to prove the new code is running.
    *   Verified "Advanced Toggles" section contains the requested isolation switches.

3.  **Type Safety**:
    *   Updated `renderingTypes.ts` to include the ledger fields in `RenderDebugInfo`.

## Verification
*   **Indicator**: "HUD v1.1 (fight-ledger enabled)" will appear under the Time label.
*   **Ledgers**: Both ledgers will appear when their arrays are populated (non-empty).
*   **Toggles**: Advanced toggles are visible when "Show Advanced Physics Toggles" is checked.
