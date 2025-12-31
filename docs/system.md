# System Architecture – Obsidian-Style Graph Physics Engine

## 1. Overview
This is a **4-phase hybrid physics engine** designed to create an organic, "living" node cloud that expands from a dense cluster into a stable network. It solves the problem of rigid, springy, or chaotic initial conditions by orchestrating a deterministic expansion sequence. The system transitions seamlessly from soft fluid-like behavior to structured rigid-body physics using a unified energy envelope.

## 2. Simulation Loop (Authoritative)
The `tick(dt)` method in `PhysicsEngine` orchestrates the frame. Execution order is strict:

1.  **Lifecycle Tick**: Update time `t`, compute `energy = exp(-t/τ)`.
2.  **Phase Logic**:
    *   **Pre-Roll**: Soft separation (special forces, no integration).
    *   **Impulse**: One-shot explosive kick (frame 0 of expansion).
    *   **Main**: Full physics integration.
3.  **Carrier Cleanup**: Manage escape windows & directional persistence timers.
4.  **Force Application**:
    *   Clear forces.
    *   Apply Repulsion (Inverse-square).
    *   Apply Springs (Hooke's law + Hub Softening).
    *   Apply Collision (Hard shell).
    *   Apply Boundary (Soft edge push).
    *   Apply Drag (User interaction override).
5.  **Integration**:
    *   `v += F/m * dt`
    *   **Symmetry Breaking**: Inject trapped hub carrier flow if needed.
    *   **Damping**: `v *= (1 - damping * dt)`
    *   **Hub Inertia**: Scale velocity for high-degree nodes.
    *   **Clamp**: Limit max velocity.
    *   `x += v * dt`
6.  **Constraint Solving (Positional)**:
    *   Iterative relaxation (Spacing, Triangle Area, Angle Resistance).
    *   **Escape Window**: Trapped nodes skip constraints here.
7.  **Deadlock Resolution**:
    *   Check for stationary center nodes.
    *   Apply one-time positional nudge if deadlocked.

**Authority**:
*   **Forces** drive velocity.
*   **Velocity** drives position.
*   **Constraints** correct position directly (violating conservation of momentum for stability).
*   **Deadlock Nudge** is the final override.

## 3. Node Model
Each `PhysicsNode` maintains:
*   **Position (`x, y`)**: World space coordinates.
*   **Velocity (`vx, vy`)**: Linear motion vector.
*   **Mass**: Derived heuristic, not strictly used in $F=ma$ everywhere.
*   **Degree**: Precalculated for performance (affects inertia & logic).
*   **State Maps (Engine-side)**:
    *   `escapeWindow`: Frames remaining to ignore constraints.
    *   `carrierDir`: Cached direction for curved escape.
    *   `carrierTimer`: Frames partial to symmetry breaking.
    *   `deadlockCounter`: Consecutive frames spent in equilibrium.

## 4. Force & Constraint Layers

### A. Force Layer (Velocity Driven)
| Force | Mechanism | Purpose |
| :--- | :--- | :--- |
| **Repulsion** | $1/d^2$ | Global "breathing room". |
| **Springs** | Hooke's Law | Topology structure. **Hubs softened** (15% strength) during expansion. |
| **Collision** | Linear push | Prevent overlap. High stiffness. |
| **Boundary** | Exponential | Keep cloud on screen. |
| **Carrier Flow** | Perpendicular to Centroid | **Symmetry breaker.** Trapped hubs drift orbitally. |

### B. Constraint Layer (Position Driven)
Runs after integration to correct geometry.
| Constraint | Mechanism | Special Rules |
| :--- | :--- | :--- |
| **Spacing** | Iterative push | Soft/Hard zones. **Skipped** if node in Escape Window. |
| **Triangle Area** | Area preservation | Prevents collapse. **Skipped** if node in Escape Window. |
| **Angle Resistance** | Stiffness | Enforces shape. **Skipped** if node in Escape Window. |

## 5. Phase Behavior

### Phase 0: Pre-Roll (Frames -5 to 0)
*   **Goal**: Soft separation before explosion.
*   **Forces**: Weak springs (10%), Spacing Repulsion.
*   **Overrides**:
    *   Constraints: **DISABLED**.
    *   Damping: **0.995** (Accumulate velocity).
    *   Velocity Cap: **Soft 8px** (No zeroing).
    *   **Micro-Carrier**: Rotational drift to prevent crystallization.

### Phase 1: Impulse (Frame 0)
*   **Action**: One-shot radial kick based on target spacing.
*   **Rotation**: Initialize global medium spin.

### Phase 2: Expansion (Energy > 0.7)
*   **Goal**: Rapid, fluid unfolding.
*   **Hub Softening**: Hub springs reduced to **15%**.
*   **Hub Inertia**: High-degree nodes accelerate slower.
*   **Trapped Hub Logic**:
    *   If $|F| \approx 0$ and $|v| \approx 0$:
    *   Activate **Carrier Flow** (orbital drift).
    *   Set **Escape Window** (6 frames).
    *   Set **Directional Persistence** (20 frames).

### Phase 3: Settling (Energy < 0.7)
*   **Goal**: Structure hardening.
*   **Forces**: Full spring strength restores.
*   **Constraints**: Full geometry constraints activate.
*   **Damping**: Increases to 0.98.
*   **Stagnation Detection** (Re-Clustering Prevention):
    *   **Trigger**: Hub (deg≥3) moving slowly (`v < 0.2px`) for prolonged period.
    *   **Action**: Apply **Thermal Impulse** ($v += \text{random} \times 0.5$).
    *   **Why**: Mimics heat ($kT > 0$) to prevent hubs from settling into invalid local minima (clumping).

## 6. Guarantees & Non-Guarantees
*   **Guaranteed**:
    *   Nodes will not overlap (Hard collision).
    *   Center nodes will eventually move (Deadlock nudge).
    *   Topology will eventually assert shape (Springs restore).
*   **NOT Guaranteed**:
    *   Conservation of momentum (Constraints inject/remove energy).
    *   Perfect symmetry (Deliberately broken).
    *   Deterministic float paths (Sim is deterministic, but sensitive).

## 7. Design Philosophy
*   **Velocity-First**: Most behavior is force-driven for fluidity.
*   **Surgical Symmetry Breaking**: We generally trust the physics, but math creates perfect equilibria (deadlocks). We detect these specific states (Trapped Hubs, Deadlocks) and apply targeted, temporary fixes (Carrier Flow, Nudge) rather than adding global noise.
*   **Hybrid Phases**: Instead of hard state switches, we use an `energy` value ($1.0 \to 0.0$) to blend behaviors, ensuring no jarring transitions.
