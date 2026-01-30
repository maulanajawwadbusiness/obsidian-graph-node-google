# Forensic Analysis: Energy Spread & Timing Mechanics

## 1. Executive Summary
This report analyzes the implementation of "energy spread" and "timing" within the physics engine. The system does not use a classic heat-map or BFS energy propagation. Instead, "spread" is achieved via a **neighbor-offloading correction system**, and "timing" is controlled by a **global energy envelope** combined with a **slush-tolerant rendering loop**.

## 2. Core Concepts ("The Bedrock")

### A. The "Medium" (Rotating Frame)
The graph exists in a rotating reference frame (`globalAngle`, `globalAngularVel`). This is the "background medium" that decays as energy drops. It is not just a container; it imparts inertial forces.

### B. Energy as a Global Scalar
"Energy" is primarily a global scalar tracking the timeline of the simulation (`lifecycle`).
- **Source:** `src/physics/engine/energy.ts`
- **Mechanism:** Exponential decay (`tau = 0.3s`).
- **Effect:** Scales force magnitude, damping, and velocity caps.
  - *High Energy (t=0):* Low damping (0.3), High MaxVel (1500), High Force Scale.
  - *Low Energy (t=1s):* High damping (0.98), Low MaxVel (50), Low Force Scale.

## 3. The "Spread" Mechanism (Spatial)

The user asked about "energy spread on node map". In this codebase, this is implemented as **Positional Correction Diffusion**.

**File:** `src/physics/engine/corrections.ts`
**Function:** `applyCorrectionsWithDiffusion`

When a node is forced to move (e.g., by a spacing constraint), it doesn't just move itself. It "spreads" the stress to its neighbors within a **Correction Budget**.

1.  **The Budget:**
    - Each node has a `nodeBudget` (max movement per frame).
    - If efficient correction > budget, it is clamped.

2.  **The Offload (Diffusion):**
    - If Node A needs to move `[dx, dy]`:
      - **Self (40%):** Node A moves 40% of the vector.
      - **Neighbors (60%):** The remaining 60% is divided among neighbors.
      - **Direction:** Neighbors are pushed in the *opposite* direction.
    - *Forensic Note:* This creates a "shockwave" effect. If you push one node, it pushes its neighbors away, propagating the displacement through the graph like a physical medium (e.g., jelly).

3.  **Resistance & Inertia:**
    - **Hub Inertia:** High-degree nodes (hubs) resist movement (`1/sqrt(degree)`).
    - **Phase Inertia:** Hubs ignore corrections during high-energy phases to prevent "expansion spikes" (`hubInertiaScale`).

## 4. The "Timing" Mechanism (Temporal)

Timing is not linear. It is gated by energy levels and managed by a "Slush" watchdog.

### A. The Spacing Gate
Constraints don't all turn on at once. Spacing constraints are **gated** to allow nodes to settle before they start pushing each other.
- **File:** `src/physics/engine.ts` (Line 438+)
- **Logic:** `spacingGate` is a value (0.0 to 1.0) that ramps up when `energy` drops below `spacingGateOnEnergy`.
- **Effect:** Nodes overlap freely during the initial "explosion" (High Energy). As energy cools, the `spacingGate` opens, and nodes begin to push apart.

### B. The "Slush" Loop (Lag Handling)
The engine separates *simulation time* from *wall-clock time*.
- **File:** `src/playground/useGraphRendering.ts`
- **Mechanism:**
  - `accumulatorMs` gathers real time.
  - `engine.tick(fixedStep)` consumes time in fixed chunks.
  - **Slush Protection:** If `accumulatorMs` exceeds `2 * fixedStep`, the system enters a distinct **Overload State**.
  - **Action:** simulation steps are *skipped* (debt dropped) rather than "spiraling" to catch up. This priorities *responsiveness* over *simulation accuracy* during heavy load.

## 5. Secondary "Spread": Local Phase Diffusion
**File:** `src/physics/engine/velocity/localPhaseDiffusion.ts`

This is a specific "spread" mechanism to break crystal structures (loops/rings).
- It calculates `localDensity` (node crowding).
- If density > threshold: It rotates the velocity vector of nodes by a random (but deterministic) small angle.
- This "diffuses" the phase of oscillation, preventing nodes from locking into synchronized vibrating crystals.

## 6. Conclusion
The "Energy Spread" is actually **Stress Diffusion**. The system treats the graph as a connected semi-rigid body where positional error is distributed to neighbors. "Timing" is an emergent property of the **Energy Envelope** gating specific constraints (like Spacing) and the **Slush Watchdog** managing the simulation clock.
