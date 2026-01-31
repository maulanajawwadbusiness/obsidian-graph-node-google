# Forensic Report: Node Movement & Physics Architecture
**Date:** 2026-01-31
**Agent:** Antigravity (Google Deepmind)
**Subject:** Deep Dissection of Node Movement Logic ("The Atomic Move")

## 1. Executive Summary
This forensic scan confirms that the Arnvoid Physics Engine implements a highly specialized **Hybrid Solver** prioritized for "Visual Dignity" (1:1 Time Match) over simulation accuracy. The "Node Move" is not a single operation but a layered negotiation between **Inertia** (Integration), **Constraints** (PBD), and **Interaction** (Hand Authority).

**Verdict:** The system is **Hardened**. Key mechanisms like "Correction Tax" and "Hot Pair Fairness" effectively prevent the "slushy" behavior typical of force-based graph layouts.

## 2. Architecture: The "Visual Dignity" Doctrine
The engine strictly adheres to the **"0-Slush"** rule defined in `physics_xray.md`:

*   **Timebase**: 1:1 Reality match. No "Syrup" (slow-motion) allowed.
*   **Overload Failure**: **Drop Debt**. If the engine falls behind (`dtHuge` or accumulator overflow), it teleports to the present rather than lagging.
*   **Degradation**: Qualitative reduction (skipping luxury passes) rather than Quantitative weakening (lowering stiffness). Structure remains rigid even at 30fps.

## 3. Forensic Dissection: The Atomic Move

The "Move" occurs in `src/physics/engine/engineTick.ts` across four distinct phases. Code analysis of the specific files follows:

### Phase A: Integration (The Intent)
**File**: `integration.ts`
*   **Mechanism**: Standard Euler integration (`x += vx * dt`).
*   **Key Findings**:
    *   **Mass Perception**: High-degree nodes (Hubs) are treated as heavier (`massFactor`), making them resistant to jitter.
    *   **Temporal Decoherence**: A deterministic `dt` skew (±2%) is applied to break symmetry and prevent equilibrium "ringing" in crystal structures.
    *   **Carrier Flow**: "Water" drift is applied here but gated by energy to ensure "Dead-Still Idle" (Fix #31).

### Phase B: Interaction (The Override)
**File**: `velocity/dragVelocity.ts`
*   **Mechanism**: **Kinematic Authority**.
*   **Logic**:
    ```typescript
    node.x = targetX; // 0-lag override
    node.vx = (targetX - prevX) / dt; // Momentum preservation
    ```
*   **Impact**: Dragging a node bypasses the solver entirely for "Knife-Sharp" responsiveness. The physics engine sees this node as an infinite-mass anchor (`isFixed`).

### Phase C: Constraints (The Correction)
**File**: `constraints.ts`
*   **Mechanism**: Position-Based Dynamics (PBD) using an accumulator.
*   **Key Guards**:
    *   **Safety Clamp**: Hard positional correction only for deep violations (>5px overlap).
    *   **Spacing Gate**: Soft repulsion ramps up corrections smoothly to prevent "popping".
    *   **Hot Pair Fairness**: Critical Fix #22 ensures violated pairs are processed 1:1 even in degraded modes, preventing "crawl" where nodes slowly drift through each other.
    *   **Hub Privilege**: During early expansion, Hubs are immune to certain constraints to allow them to "command" the layout.

### Phase D: Correction & Diffusion (The Settlement)
**File**: `corrections.ts`
*   **Mechanism**: Resolves the accumulated PBD requests.
*   **The "Fight" Killer**: Implements a **Correction Tax**:
    *   If `velocity` opposes `correction` ($v \cdot c < 0$), the engine identifies a "Limit Cycle" (vibration).
    *   **Action**: Damps 90% of the opposing velocity component. This instantly kills high-frequency jitter ("Buzz").
*   **Diffusion**: Corrections are shared with neighbors to simulate a "mesh" rather than isolated springs.
    *   **Lateral Damping**: If connected to a dragged node, lateral diffusion is suppressed (80%) to prevent "sideways squirt" when dragging through a cluster.

## 4. Stability & Move-Leak Hardening

The scan verified several "Anti-Leak" mechanisms:

1.  **Correction Residuals** (`corrections.ts`):
    *   Unpaid constraint budget is *stored* as debt (`correctionResidual`) rather than discarded.
    *   **Result**: Dense clusters don't settle into invalid states; they slowly "crawl" to validity over multiple frames.

2.  **Soft Reconcile** (`corrections.ts`):
    *   As system energy drops ($< 0.2$), constraint budget is scaled down via `smoothstep`.
    *   **Result**: Prevents microscopic solver noise from waking up sleeping nodes.

3.  **Startup Safety**:
    *   `initStrategy: "spread"` serves nodes in a valid spiral.
    *   `dt` is clamped to 32ms during the first 2 seconds to prevent "insertion shock".

## 5. Conclusion

The node movement logic is **robust**. It successfully hybridizes:
1.  **Force-Directed Layout** (Organic, visual).
2.  **Position-Based Constraints** (Rigid, non-overlapping).
3.  **Kinematic Interaction** (Responsive, predictable).

**No critical vulnerabilities found.** The separation of concerns between `integration` (intent) and `constraints` (validity) is strictly enforced.
