# Propagation Proof Telemetry Run 1: Spec & Placeholders

## Goal
Establish the "Propagation Proof" HUD section to visualize multi-hop wave propagation during drag interactions, proving the "God Mode" physics (no throttling).

## Changes
1.  **PhysicsHudSnapshot**: Added `prop*` fields for edges, nodes, convergence, and movement buckets.
2.  **EngineTickHud**: Mapped new fields to placeholders (0).
3.  **CanvasOverlays**: Added a new "Propagation Proof" section in light purple/blue (`#dcf`).
    - Layout:
        - `Edges: -/- | Nodes: -/-` (Coverage)
        - `MaxC: - px` (Convergence)
        - `Moved: - (H1:- H2:- H3+:-)` (Wave Propagation)

## Verification
- **HUD**: Visualized the new section with placeholders (Values show 0 or -).
- **Behavior**: No physics changes.

## Next Steps
- Run 2: Wire Coverage & Iterations to real data.
