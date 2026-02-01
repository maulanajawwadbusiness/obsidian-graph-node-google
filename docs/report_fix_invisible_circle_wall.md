# Invisible Circular Wall Fix (Run 7.6)

## Symptom
User reports an "invisible circular wall" when dragging nodes. Nodes ski along a circular arc at a certain distance.

## Forensic Scan
### Cause A: Radial Containment
*   **Search**: Scanned for global radial clamps.
*   **Result**: None found in `engineTickXPBD.ts` active logic. Legacy file `engineTick.ts` has one, but it's not active in XPBD mode.

### Cause B: Drag Leash (Confirmed & Fixed)
*   **File**: `src/physics/engine/engineTickXPBD.ts`
*   **Line**: 36-52
*   **Code**:
    ```typescript
    const MAX_DRAG_DISTANCE = 300; // px from initial grab position
    ...
    if (targetDist > MAX_DRAG_DISTANCE) { ... clamp ... }
    ```
*   **Analysis**: This logic forces the dragged node to stay within 300px of its *initial grab position*. This creates a perfect circular wall of radius 300px around the drag start point. This is exactly the symptom described.
*   **Fix**: Logic REMOVED. Dragged nodes are now kinematic and uncapped, following the cursor faithfully.

### Cause C: Camera Guardrails
*   **Search**: Scanned `camera.ts` for "radius" or "limit".
*   **Result**: No obvious camera-level guards found that would constrain node position.

## Implementation Plan
1.  **Remove Clamp**: Delete the `MAX_DRAG_DISTANCE` logic in `engineTickXPBD.ts`. The dragged node should follow the cursor faithfully, period.
2.  **HUD Telemetry**: Add a "Drag Wall" section to HUD to explicitly show that the leash is disabled.
3.  **Verification**:
    *   Drag node > 600px away.
    *   Verify no wall hit.
