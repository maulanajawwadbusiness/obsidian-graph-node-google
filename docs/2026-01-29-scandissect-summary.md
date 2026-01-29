# Side Report: Scandissect Node Positioning & Mover

## Overview
Performed a deep forensic scan of the positioning and movement logic in `src/physics`.

## Key Findings
- **Positioning**: Uses centroid-relative rendering with a decoupled "Rotating Reference Frame" to provide visual life without corrupting physics math.
- **Mover**: Employs a unique **Correction Budget System** that clamps positional updates from multiple constraints to prevent jitter.
- **Asymmetry**: Implements **Temporal Decoherence** (individualized time skews per node) to break symmetric equilibrium patterns automatically.
- **Inertia**: Hubs (high-degree nodes) perceive forces with temporal lag to act as structural anchors.

## Files Touched/Analyzed
- `src/physics/engine.ts`: Main tick loop and state management.
- `src/physics/engine/integration.ts`: Deterministic priority integration and dt skewing.
- `src/physics/engine/corrections.ts`: The correction budget and neighbor diffusion logic.
- `src/physics/engine/constraints.ts`: Spacing and structural constraints.
- `src/playground/useGraphRendering.ts`: Centroid and rotation mapping.

## Status
Scan complete. Logic documented. Architecture is highly stable and optimized for "Visual Dignity".
