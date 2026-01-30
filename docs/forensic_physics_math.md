# Forensic Analysis: Node Movement & Positioning Math

**Date:** 2026-01-30
**Subject:** Deep Analysis of Arnvoid Physics Engine (Math & Architecture)

## 1. Executive Summary: The "Visual Dignity" Doctrine

The physics engine is architected around a single non-negotiable principle: **Visual Dignity (0-Slush)**.

*   **Principle**: The simulation time must *never* drift from wall-clock time ("Syrup"). If the engine cannot keep up, it deletes time ("Teleports") rather than slowing down.
*   **Result**: The graph feels crisp and responsive (1:1) or it stutters (drop), but it never feels "muddy" or "floaty".
*   **Mechanism**: The `useGraphRendering.ts` scheduler enforces a Hard Debt Drop. If `accumulatorMs` remains > 0 after the budget is exhausted, it is arguably reset to 0, ensuring the next frame starts fresh.

## 2. The Time Domain (The Scheduler)

Located in: `src/playground/useGraphRendering.ts`

The loop uses a **Fixed-Step Accumulator with Debt Cancellation**:

```typescript
// The 0-Slush Logic
while (accumulatorMs >= fixedStepMs && stepsThisFrame < maxStepsPerFrame) {
    if (budgetExceeded) break;
    engine.tick(fixedStepMs);
    accumulatorMs -= fixedStepMs;
}

// THE KILL SWITCH
if (budgetExceeded || capHit) {
    if (accumulatorMs > 0) {
        // DELETE THE DEBT. Teleport to Now.
        accumulatorMs = 0; 
    }
}
```

*   **Implication**: Nodes do not "travel" through the dropped time. They effectively freeze for the dropped duration and then resume at the *current* wall time. This prevents the "spiraling death" loop common in physics engines where lagging causes more lag.

## 3. The Spatial Domain (The Hybrid Solver)

Located in: `src/physics/engine.ts` (Dispatcher)

The solver is a **Hybrid Force-PBD (Position Based Dynamics)** pipeline. It mixes soft forces (Velocity/Acceleration) with hard geometric constraints (Position Corrections).

**Execution Order:**
1.  **Force Accumulation** (Soft): Springs, Repulsion, Center Gravity.
2.  **Velocity Pass**: Damping, Drag, Inertia, Pre-Roll.
3.  **Integration**: `x += v * dt` (Euler).
4.  **Constraints** (PBD): Spacing, Triangle Area, Safety Clamp.
5.  **Correction Diffusion**: Smoothing the PBD jitter.

### A. Deep Dive: Integration & Decoherence
Located in: `integration.ts`

*   **Deterministic Chaos (Decoherence)**: To prevent stable resonance patterns (standing waves), the engine artificially varies `dt` per node.
    *   `nodeDt = dt * (0.98 to 1.02)` based on node ID hash.
    *   **Fix #15**: This skew is disabled for the *Dragged Node* to ensure it sticks 1:1 to the mouse ("Hand Authority").
*   **Degree-Based Inertia**:
    *   `effectiveMass = mass * (1 + 0.4 * degree)`.
    *   High-degree hubs are artificially heavier. This acts as a low-pass filter on their movement, preventing them from jittering due to the sum of many small neighbor forces.

### B. Deep Dive: Forces & Symmetry Breaking
Located in: `forcePass.ts`

*   **Pre-Roll Phase (The "Lotus Open")**:
    *   For the first 5 frames, springs are weak (10%).
    *   **Hub Scaling**: Hubs (degree >= 3) get even weaker springs (25%) to allow leaves to spread out before the structure tightens.
*   **Null-Force Symmetry Breaking**:
    *   If a node has `force < epsilon`, the engine injects a tiny deterministic bias or pushes it away from its cluster centroid.
    *   **Why**: Mathematically perfect symmetry (e.g., a perfect star/grid) is a "trap" where forces sum to zero. This "noise" ensures the graph explores configuration space.

### C. Deep Dive: Constraints (PBD)
Located in: `constraints.ts`

This is where the "Crispness" comes from. Constraints directly modify `x,y` *after* integration.

1.  **Dual-Zone Spacing**:
    *   **Soft Zone**: `D_hard` to `D_soft`. Uses an exponential ramp (`s^exponent`) to apply gentle resistance.
    *   **Hard Zone**: `< D_hard`. Uses a `smoothstep` ramp (`t*t*(3-2t)`) to apply forceful separation.
    *   *Forensic Note*: The use of `smoothstep` in the hard zone eliminates the "chatter" or "pop" often seen with linear clamps.
2.  **Triangle Area Spring**:
    *   Identifies triangles (A-B-C cliques).
    *   Calculates Signed Area.
    *   If `Area < RestArea`, pushes vertices outward along their altitude vectors.
    *   *Result*: Prevents "face collapse" where a triangle folds into a line.
3.  **Safety Clamp**:
    *   If `penetration > 5px`, it applies an "Emergency Correction".
    *   **Hysteresis**: It tracks clamped pairs to avoid oscillating between clamp and release.

### D. Deep Dive: Correction Diffusion
Located in: `corrections.ts`

Standard PBD can be jittery because solving Constraint A might violate Constraint B.

*   **Budget System**: Each node has a `maxCorrectionPerFrame`.
*   **Diffusion**:
    *   If Node A needs a correction `dx`, it applies `40%` to itself.
    *   It "diffuses" `60%` to its neighbors (pushing them in the opposite direction).
    *   *Result*: The error term is spread across the local mesh like heat, preventing "hot spots" of jitter.
*   **Hub Inertia (Phase-Aware)**:
    *   Hubs accept corrections slower (`hubInertiaScale`) during the "Expansion" phase (Energy < 0.8).
    *   This prevents the "Pop" artifact where the outer ring expands and yanks the center node violently.

## 4. Edge Case Mechanisms (The "16 Fixes")

A forensic mapping of the recent fixes to the code:

1.  **Impulse Guard (`impulse.ts`, `engine.ts`)**:
    *   `requestImpulse` checks `now - lastImpulse < 1000ms`.
    *   Guard: `if (draggedNodeId) return;` (Don't kick while holding).
2.  **Render Drift (`integration.ts`)**:
    *   `if (config.enableMicroDrift) globalAngle += sin(t)...`
    *   This moves the *camera/world*, not the nodes. It creates life without altering physics equilibrium.
3.  **Interaction Bubble (`engine.ts`)**:
    *   `draggedNode` + `neighbors` are forced into `Bucket A` (Full Physics).
    *   Even if the global graph is in `Degrade Level 2` (skipping passes), the node under your finger updates at 60Hz.

## 5. Summary of Mathematical "Texture"

The "Feel" of this engine is defined by:
1.  **Asymmetry**: `dt` skew and Null-Force bias prevent static looking layouts.
2.  **Hierarchy**: Hubs are heavy and slow; leaves are light and fast.
3.  **Visual dishonesty for UX**: The "Drop Debt" (Teleport) looks better than "Slow Motion" (Lag).
4.  **Local vs Global**: The "Interaction Bubble" allows high-fidelity interaction in a low-fidelity simulation environment.
