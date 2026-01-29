# Arnvoid Physics Architecture: The Forensic Report

## 1. Core Philosophy: "Visual Dignity"
The Arnvoid Physics Engine (`src/physics`) is NOT a standard Force-Directed Graph (FDG).
While it uses FDG principles (repulsion/springs) for macro-layout, its core objective is **Visual Dignity**—the stabilization of the graph into an organic, "living" form that feels premium and intentional.

It prioritizes:
1.  **Beauty over Truth**: Positions are nudged ("Edge Relaxation") and rotated ("Rotating Frame") for visual effect.
2.  **Fluidity over Geometry**: Nodes behave like viscous fluid particles (via "Correction Diffusion") rather than rigid bodies.
3.  **Life over Stasis**: It actively prevents the graph from "freezing" (via "De-locking").

## 2. The Loop: `PhysicsEngine.tick()`
The heart of the system runs 60 times a second (`dt ~0.016`).
Unlike simple engines, it executes a strict **Multi-Pass Pipeline**:

### Phase I: Lifecycle Management
1.  **Pre-Roll**: A 5-frame "soft startup" where springs are weak and collision is off. This prevents the "Big Bang" explosion common in other engines.
2.  **Impulse**: A single radial explosion at frame 0.1 to unstuck the initial cluster.
3.  **Cooling**: An exponential energy envelope (`computeEnergyEnvelope`) that scales forces down over time, eventually settling into "low-energy maintenance mode."

### Phase II: Force Integration (The Accelerator)
Standard forces are calculated but with specific twists:
-   **Forces**: Repulsion (Shell only), Springs (Topology behavior), Gravity (Centering).
-   **Inertia**: High-degree nodes (Hubs) are artificially heavier.
-   **Temporal Decoherence**: Each node has a random `dt` skew (±3%). This prevents symmetry. Two identical nodes will move at slightly different speeds, breaking "starfish" patterns.

### Phase III: Integration (The Mover)
-   **Velocity**: Updates `x, y` based on forces.
-   **Buoyancy Layer 1 (Micro-Drift)**: The `globalAngle` is updated with a hardcoded Sine Wave (`sin(t*0.3) + ...`). This rotates the camera, not the nodes.

### Phase IV: Velocity De-locking (The Anti-Freeze)
A series of passes in `velocityPass.ts` to prevent "Dead Crystal" states:
-   **Micro-Slip**: Breaks static friction.
-   **Phase Diffusion**: Randomizes velocity direction slightly to erase "shape memory."
-   **Results**: Nodes are always vibrating infinitesimally, looking "alive."

### Phase V: The Correction Budget (The Stabilizer)
Startlingly, the engine does **not** rely on forces for constraints (like spacing). It uses **Position-Based Dynamics (PBD)** with a budget.
-   **Accumulator**: Constraints (Minimum Distance, Triangle Area, Edge Length) request corrections (`dx, dy`).
-   **Budget Clamping**: The total move is capped (e.g., `0.5px` per frame).
-   **Diffusion**: If Node A is pushed, it "shares" 60% of that move with its neighbors.
-   **Effect**: The graph acts like a **Net**, not a bag of marbles. Pressure distributes.

## 3. Key Subsystems

### A. The Buoyancy System
A three-layer illusion:
1.  **Render Rotation**: The camera gently rocks (Micro-Drift).
2.  **Viscous Damping**: Heavy air friction (0.90) kills rapid oscillation.
3.  **Neighbor Drag**: Correction diffusion makes the graph feel "heavy" and connected.

### B. The Structure System
1.  **Hub Lag**: Hubs perceive forces 30% slower than leaves. This acts as a low-pass filter, creating stable "anchors" amidst chaotic leaves.
2.  **Triangle Springs**: A custom constraint forces triangles to maintain their area, preventing the graph from collapsing into a flat line.

### C. The Interaction System
-   **Hand of God**: Dragging a node sets `isFixed = true`.
-   **Wake Propagation**: Dragging wakes up neighbors, ensuring the graph locally "melts" to allow the drag.

## 4. Data Model
-   **Nodes**: `PhysicsNode { x, y, vx, vy, mass, warmth }`
-   **Links**: `PhysicsLink { source, target, strength, length }`
-   **Config**: `ForceConfig` (Hot-swappable parameters).

## Conclusion
The Arnvoid Engine is a sophisticated **Hybrid Solver** (Force + PBD + Visual Hacks). It is engineered specifically to avoid the "nervous jitter" of web-based graphs and instead deliver a slow, heavy, premium "underwater" feel.
