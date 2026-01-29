# Forensic Report: Node Positioning & Mover Logic (2026-01-29)

## 1. Executive Summary
The Arnvoid "Mover" is not a standard force-directed graph. It is a multi-pass hybrid engine that combines **Force-Based Dynamics** for macro movement with **Position-Based Dynamics (PBD)** for structural stability and **Temporal Decoherence** for symmetry breaking.

## 2. Positioning Logic (The World Map)
Nodes live in a 2D coordinate space defined by `PhysicsNode { x, y }`.

### A. Coordinate Authority
- **Base Space**: A virtual canvas (default 2000x2000).
- **Centroid Centering**: The engine calculates a live `centroid` (average of all `x, y`).
- **Render Translation**: At render time (`useGraphRendering.ts`), the camera is transformed to center this centroid on the screen.
- **Rotating Reference Frame**: The engine maintains a `globalAngle` and `globalAngularVel`. This rotation is applied *only* during rendering around the centroid, meaning the physics "doesn't know" it's spinning. This prevents rotational inertia from corrupting the force calculations.

## 3. The Mover (The Physics Engine)
The move logic is split into three distinct phases within `PhysicsEngine.tick()`.

### Phase I: Force Integration (`forcePass.ts` & `integration.ts`)
Standard accelerations are calculated: `a = (Repulsion + Springs + Gravity + Boundaries) / mass`.
- **Inertia Modulation**: High-degree nodes (hubs) have their mass artificially increased.
- **Force Lag**: Hubs perceive forces with a 30% temporal lag (`prevFx`), preventing them from overreacting to leaf-node jitter.
- **Temporal Decoherence**: Each node is assigned a deterministic 3% `dt` skew based on its ID hash. This ensures that even in perfectly symmetric graphs, nodes move at slightly different "speeds," naturally breaking structural eigenmodes (the "Starfish" effect).

### Phase II: Velocity De-locking (`velocityPass.ts`)
A series of micro-passes prevent "Dense Core Locking":
- **Micro-slip**: Small random velocity injections break static friction.
- **Phase Diffusion**: Erases "shape memory" by slightly randomizing velocity directions.
- **Stagnation Escape**: If a node is near equilibrium but has neighbors, it receives a tiny "edge shear" nudge.

### Phase III: The Correction Budget System (`constraints.ts` & `corrections.ts`)
This is the most critical part of the Arnvoid mover. Instead of forces, constraints (Spacing, Triangle Area, Edge Relaxation) use **Position Corrections**.
- **Accumulation**: All constraints "request" moves (`dx, dy`) in a central accumulator.
- **Budgeting**: Total move magnitude for a node is capped by `maxNodeCorrectionPerFrame`. This ensures that if a node is squeezed by three directions, it doesn't "explode" but moves gracefully.
- **Diffusion**: 60% of a node's correction is shared with its neighbors. This "Correction Diffusion" allows pressure to flow through the network like a liquid, rather than snapping like a brittle wire.

## 4. Interaction (Hand of God)
- **Direct Control**: Dragged nodes are marked `isFixed`. 
- **The Leash**: A high-strength spring (`dragStrength: 200.0`) pulls the node toward the `dragTarget`.
- **Wake Propagation**: Dragging a node calls `wakeNeighbors`, ensuring the surrounding graph "melts" to accommodate the movement.

## 5. Architectural Sentiment
The system is designed for **Visual Dignity** over physical accuracy. The use of Correction Diffusion and Temporal Decoherence suggests a focus on organic, "living" movement that resists the stiff, geometric traps common in standard Force-Directed Graphs (FDG).
