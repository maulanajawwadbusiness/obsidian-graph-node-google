# Forensic Report: Projection Velocity & Damping Order

## 1. Mutation Sites (Anchors)

### A. Position Teleports (Projections)
These modify `x/y` directly. If `prevX/prevY` is not also moved, the Euler integrator interprets the jump as a massive velocity spike `(x - prev)/dt`.
1.  **Constraints (PBD)**: `src/physics/engine/constraints.ts`
    -   `applyEdgeRelaxation`
    -   `applySpacingConstraints`
    -   `applyTriangleAreaConstraints`
    -   `applySafetyClamp`
    -   *Risk*: High. These are the main source of "Ghost Velocity".
2.  **Boundary Clamp**: `src/physics/engine/forces.ts` -> `applyBoundaryForce` (Wait, this uses FORCE `fx +=`, not position. Need to double check).
    -   *Correction*: `applyBoundaryForce` in `forces.ts` modifies `fx`, NOT `x`. It is a force, not a clamp.
    -   *Wait*, `engineTick.ts` Fatal Mode Containment might behave differently? No, it calls `applyBoundaryForce`.
    -   *Verification*: Check if there is a `clampPosition` anywhere.
3.  **Drag**: `src/physics/engine/velocity/dragVelocity.ts`
    -   Sets `x = targetX`.
    -   Sets `vx = (x - prevX)/dt`. (This is correct! It auto-reconciles).
4.  **Firewall (NaN Reset)**: `src/physics/engine/engineTick.ts`
    -   `node.x = lastGoodX`.
    -   *Risk*: Teleport. Should reset `prevX = x` to kill velocity? Or `prevX = x - v*dt`?

### B. Velocity Clamps
These modify `vx/vy` directly. To maintain Verlet consistency (`v ~ dx/dt`), we must back-propagate the change to `prevX`.
1.  **Max Velocity**: `src/physics/engine/velocity/baseIntegration.ts` -> `clampVelocity`.
    -   Scaling `v` without moving `prevX` means `(x-prevX)` still implies the *old* higher velocity.
2.  **Damping**: `src/physics/engine/velocity/damping.ts`.
    -   `v *= damping`.
    -   Logic: Friction.

## 2. Damping Verification
-   **Current Order**:
    1.  `integrateNodes` (Integrator)
        -   `applyBaseIntegration` (`v += a*dt`)
        -   `applyDamping` (`v *= damp`)
        -   `clampVelocity`
        -   `x += v*dt`
    2.  `applyForcePass` (Forces) - Wait, Forces run BEFORE integration.
    -   *Correct Order in `engineTick.ts`*:
        -   Forces -> `fx`
        -   Drag/PreRoll -> `vx` (Direct mod)
        -   Integrate -> `v += f`, `v *= damp`, `x += v`
        -   Constraints -> `x += d` (PBD)
        -   Corrections -> `x += dDiff`
-   **Problem**: Constraints (`x += d`) happen *after* Integration.
    -   The `x` is moved. `v` is NOT updated (we disabled `reconcile`).
    -   Efficiency: The PBD correction is "Zero Energy" (Teleport).
    -   Next Frame: `prevX` is snapshotted to `x`. `v` remains "pre-correction".
    -   Is this a problem?
    -   If `prevX` follows `x` (Strategy A), then effective velocity of the correction is 0.
    -   The `v` from integration remains. PBD just fixes position.
    -   This seems correct for "Overdamped" or "Position-Based" physics mixed with Euler.

## 3. Plan
1.  **Fix Projections**: In `constraints.ts` and `corrections.ts`, whenever `node.x += d`, run `node.prevX += d`.
2.  **Fix Velocity Clamps**: In `clampVelocity`, if `v` is scaled, `prevX = x - v*dt`.
3.  **Firewall**: If resetting to `lastGood`, also reset `prevX`.

## 4. Metrics
-   `snapPosDelta`: Max `d` applied by PBD.
-   `historyMismatch`: `|(x - prevX)/dt - v|`.
    -   Actually, if `prevX` tracks `x` perfectly, this difference tracks "How much `v` deviates from `dx/dt`".
    -   In Symplectic Euler `x_new = x_old + v*dt`.
    -   So `(x_new - x_old)/dt = v`.
    -   Any deviation means `x` was moved by something other than `v` (i.e. PBD).
    -   So `historyMismatch` = PBD correction magnitude.
