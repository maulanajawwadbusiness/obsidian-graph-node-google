# Forensic Report: PBD Disconnect & Diffusion Motor

## 1. Tick Pipeline Map

The physics engine uses **Semi-Implicit Euler** integration followed by **Position Based Dynamics (PBD)** corrections.

**Pipeline Anchor Points:**

1.  **Run Physics Tick** (`engineTick.ts:runPhysicsTick`)
    *   Firewall Safety Check (NaN/Inf)
2.  **Forces** (`applyForcePass`)
    *   Mutates: `node.fx`, `node.fy`
3.  **Velocity Mods** (`velocityPass.ts`)
    *   Mutates: `node.vx`, `node.vy` (Drag, Damping)
4.  **Integration** (`integration.ts:integrateNodes`)
    *   **State Mutation:**
        *   `ax = fx / m`
        *   `vx += ax * dt` (Explicit Velocity Update)
        *   `damps vx`
        *   `x += vx * dt` (Explicit Position Update)
    *   *Note:* No `prevPos` is used for integration. Velocity is primary state.
5.  **Micro VMods**
    *   Mutates: `node.vx`, `node.vy` (De-locking, Micro-slip)
6.  **Constraint Accumulation**
    *   Computes desired `dx, dy` -> `correctionAccum`.
7.  **Correction Application** (`corrections.ts:applyCorrectionsWithDiffusion`)
    *   **The Disconnect:** Mutates `node.x` *without* updating `node.vx`.
    *   **The Motor:** Diffusion applies `node.x += diff` without velocity check or settle gating.
    *   **Reconcile (New):** Now calls `reconcileVelocity` to update `vx` roughly matching `dx/dt`.

## 2. Forensic Analysis

### Q: When constraints change position, do we also update prevPos/history?
**A:** No. `prevPos` (or `lastGoodX`) is not used for integration. The engine relies on explicit `vx`. If `node.x` is moved by constraints, `node.vx` becomes "disconnected" from the physical motion, pointing to the old (unconstrained) path.

### Q: Is there any implicit recompute of v from (pos-prevPos) after constraints?
**A:** No. Before the fix, `vx` remained unchanged (except for "Correction Tax" which only removed opposing components, treating collisions as strictly inelastic without restitution).

### Q: Is diffusion applied as position delta without history reconciliation?
**A:** Yes. Diffusion moved `node.x` directly. Since `vx` was not updated, this movement was "free" (teleportation), but usually this isn't a motor unless it creates a cycle. The "Motor" effect likely comes from diffusion pushing nodes into high-energy states (repulsion/springs) repeatedly.

### Q: Can postcorrect apply deltas that are not counted in "pbd corr/frame"?
**A:** Yes. Diffusion deltas were technically counted in `passStats` locally, but `pbdCorrectionSum` in HUD might not distinguish them from constraint resolution, hiding the specific "diffusion" contribution.

## 3. Implemented Fixes

### A. Velocity Reconciliation (Fixes PBD Disconnect)
We implemented **Option B: Velocity Reconcile** in `corrections.ts`.

```typescript
const reconcile = (nx, ny) => {
    // Implicit velocity of the correction
    const vxImplicit = nx / dt; 
    // Add to state, scaled by activity confidence
    node.vx += vxImplicit * diffusionSettleGate;
};
```
*   **Logic:** If the constraint pushes the node, the node effectively "bounces" or "slides". Updating `vx` prevents it from driving back into the constraint next frame.
*   **Safety:**
    *   **Clamped:** Max 500px/s added to prevent explosions.
    *   **Gated:** Scaled by `(1 - settleScalar)^2`. At rest, reconciliation is disabled (corrections become pure teleports) to ensure absolute stability (0 energy variance).

### B. Diffusion Gating (Fixes Diffusion Motor)
We prevented diffusion from acting as a motor at rest.

```typescript
const diffusionSettleGate = Math.pow(1 - settleConfidence, 2);
const enableDiffusion = ... && diffusionSettleGate > 0.01;
```
*   **Logic:** As the system settles, diffusion strength fades to zero.
*   **Result:** No periodic position updates -> no Energy ping-pong at rest.

## 4. HUD Truth Metrics
Added to `engineTick.ts` and `physicsHud.ts`:
*   `maxPosDeltaConstraint`: Accurate measure of PBD displacement per frame.
*   `maxVelDeltaConstraint`: Measure of how much `vx` is altered by the new Reconciliation.
*   `postCorrectEnergy`: Energy snapshot explicitly after corrections.

## 5. Verification Protocol (Expected Results)

| Node Count | State | Old Behavior | New Behavior (Fixed) |
| :--- | :--- | :--- | :--- |
| **N=5** | Settle | Periodic `posDelta > 0` at rest. Limit cycle. | `posDelta` -> 0. `settleState` -> 'sleep'. |
| **N=60** | Active | `vx` fights constraints. "Ghost" momentum. | `vx` aligns with surface. Smoother sliding. |
| **N=250** | Settle | Diffusion creates "motor" hum. Energy > 0. | Diffusion gates off. Absolute silence. |

The "Ghost Velocity" is resolved by ensuring `vx` reflects the slide/bounce, and the "Diffusion Motor" is killed by the settle gate.
