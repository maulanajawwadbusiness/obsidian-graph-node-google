# Forensic Report Phase 6: Ref Identity Mismatch

## Evidence Synthesis
1.  **Input Active**: Input Handler sets `pending=true`.
2.  **Seam Success**: Render Loop reaches Line 1000 (just before hover check).
3.  **Missing Result Logs**: `updateHoverSelection` is NOT called.
    - Note: The missing "Gate Log" was caused by a Probe Bug (`undefined` math), but the missing "Result Log" (safe code) is real evidence.
4.  **Logical Implication**:
    - `updateHoverSelectionIfNeeded` IS called (flow reaches it).
    - But it decides `shouldRun = false`.
    - `shouldRun` depends on `pendingPointer`.
    - Therefore, the Loop sees `pendingPointer = false`.

## The Contradiction
- Input Handler: `pending=true`
- Render Loop: `pending=false`

## Conclusion: Split Brain (Ref Mismatch)
The `GraphPhysicsPlayground` component and the `startGraphRenderLoop` function are operating on **different instances** of `pendingPointerRef`.
Input writes to Instance A.
Loop reads from Instance B.

## Root Cause Logic
This typically happens when:
1.  `useGraphRendering` hook creates refs.
2.  `startGraphRenderLoop` is called with those refs.
3.  React re-mounts or re-renders, causing a **new** hook instance (and new refs) to be created.
4.  But the **old loop** (using old refs) is not stopped, or the **new loop** is not started with the new refs.
5.  Or, the Input Handler is bound to the **new refs**, but the Loop continues running with **old refs**.

## Recommended Fix
1.  **Fix the Probe**: Fix the NaN bug in Gate Log to confirm the ID mismatch visually.
2.  **Fix the Architecture**: Ensure `startGraphRenderLoop` is cleaned up (`stop()`) on unmount/re-effect, and restarted with new refs.
3.  **Verification**: The `refId` logs (once Gate probe is fixed) will be different numbers (e.g., `ptr-500` vs `ptr-800`).
