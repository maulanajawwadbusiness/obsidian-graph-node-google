# Forensic Physics Audit: "Visual Dignity" & Engine Personality
**Date:** 2026-01-31
**Code Agent:** Antigravity

## 1. Executive Summary
The Arnvoid Physics Engine is not a pure simulation; it is a **Hybrid Kinetic Solver** optimized for "Visual Dignity" (smoothness, responsiveness, organic feel) over physical correctness. It prioritizes **1:1 Time Matching** (never slowing down) and uses aggressive direct-manipulation techniques ("cheats") to solve graph layout problems that pure physics (springs/repulsion) cannot efficiently handle.

## 2. Core Doctrine: "The Sacred 60"
*   **Timebase**: Strictly 1:1. `accumulatedMs` is dropped if it exceeds `maxStepsPerframe`. Teleportation (stutter) is preferred over "syrup" (slow-motion).
*   **Degrade Policy ("No Mud")**: When stressed, the engine skips **entire passes** (e.g., far-field spacing, diffusion) rather than weakening forces. This preserves the "crisp" structure of the graph even at low frame rates.
*   **Buckets**:
    *   **A (Sacred)**: Integration, Dragged Node (Local Boost).
    *   **B (Structural)**: Springs, Repulsion (Frequency reduced, stiffness normalized).
    *   **C (Luxury)**: Far-field spacing, Deep Diffusion (Aggressively throttled).

## 3. Architecture Layering (The "Stack")

### Layer 1: Force Pass (The "Soft" Driver)
*   **Energy Envelope**: Forces scale by `energy` (exponential decay, tau=0.3s).
*   **Pre-Roll**: Uses **Hub Topology Scaling** (hubs get weaker springs) to allow untangling before stiffening.
*   **Symmetry Breaking**: "Null-Force" detector adds deterministic bias to hubs in equilibrium to prevent "starfish/brick" formation.

### Layer 2: Velocity Pass (The "Personality")
This layer implements "Organic" behaviors by directly modifying velocity, acting as a "Director" rather than a physicist.
*   **`CarrierFlow`**: Detects "trapped hubs" (low force/vel in dense clusters) and pushes them perpendicular to the local cluster centroid. *Effect:* Clusters "flow" like liquid rather than jamming.
*   **`DenseCoreInertiaRelaxation`**: "Momentum Memory Eraser". Blends a node's velocity toward the average neighbor velocity if it's stuck. *Effect:* Prevents nodes from orbiting their original position ("ghost origin").
*   **`EdgeShearStagnationEscape`**: "Null-Gradient Unlock". If a pair is perfectly at rest length but stagnant, applies perpendicular shear. *Effect:* Unlocks "jammed" perfect pairs.
*   **`LocalPhaseDiffusion`**: Randomizes phase angle (0.3°-0.8°) in dense cores. *Effect:* Breaks synchronized oscillation rings.

### Layer 3: Integration (The "Timekeeper")
*   Standard Euler: `x += v * dt`.
*   **1:1 decoupled time**: `dt` is derived from `performance.now()`.

### Layer 4: Constraints (The "Hard" Reality)
*   **PBD (Position Based Dynamics)**:
    *   `SafetyClamp`: Hard positional correction if overlap > 5px.
    *   `Spacing`: Soft zone (ramps up) → Hard zone (absolute barrier).
    *   `EdgeRelaxation`: Gentle (2%) shape nudge.
*   **Correction Tax (New)**: Detects velocity opposing correction (`v · c < 0`) and "taxes" (damps) it. *Effect:* Kills limit-cycle jitter.
*   **Soft Reconcile (New)**: Fades constraint budget with temperature to prevent rest-state micro-jitter.

## 4. Move-Leak Hardening ("The Shield")
The engine implements strict invariants to prevent "drift" and "leaks":
*   **Correction Residue**: Unpaid constraint budget is stored as debt, preventing dense clusters from crawling indefinitely.
*   **Fixed Node Authority**: Dragged nodes (`isFixed`) are immune to forces.
*   **Interactive Priorities**: Dragging a node triggers **Local Boost** (Force Level 0) for it and its neighbors, ensuring silky-smooth interaction even during global lag.
*   **Deadzone**: Motions < 0.5px are ignored to prevent sub-pixel drift.

## 5. Conclusion
The engine is a sophisticated "illusionist". It uses standard physics for the base layout but relies on a complex suite of **Velocity Modifiers** (Carrier Flow, Inertia Relaxation, Shear Escape) to solve the "last mile" of graph layout (untangling, jamming, settling) that standard force-directed algorithms fail at. The recent addition of "Correction Tax" aligns perfectly with this philosophy: identifying a specific failure mode (limit cycle) and surgically removing the energy feeding it.
