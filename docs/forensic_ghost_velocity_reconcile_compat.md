# Forensic Report: Ghost Velocity & Reconcile Compatibility
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROPOSAL (Ready for Implementation)

## 1. Current Motion Model Scan
The engine uses a **Semi-Implicit Euler** integrator with an explicit `prevX` history step.

### A. State Lifecycle
1.  **Archive (`engineTickPreflight.ts:33`)**:
    *   `node.prevX = node.x`
    *   Occurs **Start of Tick**.
    *   Crucial: This strictly captures $x^n$.

2.  **Force Accumulation**:
    *   `forces.ts`: `node.fx += ...`
    *   Forces are applied to `vx` *before* integration.

3.  **Integration (`integration.ts`)**:
    *   `vx += (fx/m) * dt`
    *   `x += vx * dt` (Prediction step $x^*$)
    *   *Note: Current system applies constraints efficiently via velocity mods or post-integ PBD.*

4.  **Rebase Safety (`engineTick.ts:348`)**:
    *   When world shifts, `x` and `prevX` are **both** shifted.
    *   **Verdict**: Safe. Velocity is invariant under translation.

## 2. The Reconcile Law (XPBD Contract)
To integrate XPBD without "Ghost Velocity" (phantom energy injection), we must enforce a single source of truth for velocity: **Position Change**.

### The Chosen Law: Velocity Rebuild (Option A)
$$ v^{n+1} = \frac{x^{n+1} - x^n}{dt} $$

**Implementation Checklist:**
1.  **Disable Legacy Velocity Mods**:
    *   Any system trying to "fix" velocity directly (e.g., `applyAngleResistanceVelocity`) complicates the rebuild.
    *   **Action**: In XPBD mode, disable most `velocityPass.ts` modules except Drag/Air Resistance.

2.  **The Reconcile Stage**:
    *   **Placement**: Immediately after Constraint Solver, *before* Finalize.
    *   **Code**:
        ```typescript
        // Reconcile Velocity from Position Delta (XPBD standard)
        if (!node.isFixed) {
            node.vx = (node.x - node.prevX) / dt;
            node.vy = (node.y - node.prevY) / dt;
        }
        ```

3.  **Drag Interaction**:
    *   Dragged nodes are `isFixed`. Reconcile skips them.
    *   When released (`isFixed` -> `false`), `prevX` is old.
    *   **Fix**: On release, ensure `prevX = x - v_desired * dt` OR accept that the first tick calculates "throw velocity" from the mouse movement (which is usually correct and desired).

## 3. Edge Case Coverage

### A. Multi-Tick Catch-Up
The scheduler runs `engine.tick(dt)` multiple times.
*   **Result**: `prevX` is reset at the start of *each* sub-tick.
*   **Safety**: Reconcile works on the *sub-tick* `dt`. Velocity is correct for that slice.
*   **Frame Sum**: No velocity explosion.

### B. Safety Clamps
If `applySafetyClamp` (constraints.ts) teleports a node (e.g. NaN reset or World Bound hard clamp):
*   `x` changes abruptly.
*   `prevX` remains old.
*   **Reconcile Result**: Massive velocity spike ($v = \Delta x / dt$).
*   **Mitigation**:
    *   Hard Clamps/Resets (Firewall) must acting on **both** `x` and `prevX`, OR explicitly zero `v` after valid clamp.
    *   **Recommendation**: `firewallStats` resets (NaN) already reset `prevX`. Boundary Force is soft. Hard boundary clamp (if added) must zero velocity.

### C. Damping Compatibility
*   **Issue**: `applyDamping` runs in `integration.ts` (Pre-Solve).
*   **XPBD**: Damping should ideally happen *after* collision?
*   **Verdict**: Pre-solve damping (Air Resistance) is fine. It reduces $x^*$.
*   **Post-Solve Damping**: If we need "Contact Damping", it must be a velocity constraints or a post-reconcile decay.
*   **Plan**: Keep Pre-Solve Damping. It simulates air drag correctly.

## 4. Implementation Plan
1.  **Create `reconcile.ts`**: A dedicated pass for Velocity Reconcile.
    *   Inputs: `nodes`, `dt`.
2.  **Wire into `engineTick.ts`**:
    *   Place after `applyCorrectionsWithDiffusion`.
    *   Gate with `!config.debugDisableReconcile`.
3.  **Disable Competing Systems**:
    *   If XPBD active, disable `applySprings` (Legacy) and ensure `springStiffness` doesn't double-dip.
    *   (Actually, we replace `applySprings` with `applyXPBDSprings`).

**Signed:** Antigravity
**Date:** 2026-02-01
